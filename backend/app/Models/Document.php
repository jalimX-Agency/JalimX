<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * A quote or an invoice.
 *
 * Money is added up here rather than stored: the lines are the truth, and a
 * stored total is one migration away from disagreeing with them. Every sum
 * is done in centimes as integers, because 0.1 + 0.2 is not 0.3 and an
 * invoice is the worst place to find that out.
 */
class Document extends Model
{
    public const TYPES = ['quote', 'invoice'];

    /** Shared by both types; the dashboard only offers the ones that fit. */
    public const STATUSES = ['draft', 'sent', 'accepted', 'declined', 'cancelled'];

    /** A discount is a share of the lines, or a fixed sum off them. */
    public const DISCOUNT_TYPES = ['percent', 'amount'];

    protected $fillable = [
        'client_id', 'engagement_id', 'type', 'status',
        'issue_date', 'due_date', 'period', 'currency', 'tva_rate',
        'discount_type', 'discount_value', 'discount_label',
        'subject', 'notes', 'terms',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'period' => 'date',
            'tva_rate' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'bill_to' => 'array',
            'issued_by' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function engagement(): BelongsTo
    {
        return $this->belongsTo(Engagement::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DocumentItem::class)->orderBy('position')->orderBy('id');
    }

    /** The last time it went out on WhatsApp, with how far it got. */
    public function latestWhatsApp(): HasOne
    {
        return $this->hasOne(WhatsAppMessage::class)->latestOfMany();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderBy('paid_on');
    }

    /** The lines added up, before any discount, in centimes. */
    public function grossCentimes(): int
    {
        return $this->items->reduce(
            fn (int $sum, DocumentItem $item) => $sum + $item->totalCentimes(),
            0,
        );
    }

    /**
     * What the discount takes off, in centimes. Never more than the lines
     * come to: a discount does not turn an invoice into a refund.
     */
    public function discountCentimes(): int
    {
        $value = (float) $this->discount_value;
        if (! $this->discount_type || $value <= 0) {
            return 0;
        }

        $gross = $this->grossCentimes();
        $off = $this->discount_type === 'percent'
            ? (int) round($gross * min($value, 100) / 100)
            : (int) round($value * 100);

        return min($off, $gross);
    }

    /** Untaxed total after the discount — what VAT is worked out on — in centimes. */
    public function subtotalCentimes(): int
    {
        return $this->grossCentimes() - $this->discountCentimes();
    }

    public function tvaCentimes(): int
    {
        return (int) round($this->subtotalCentimes() * (float) $this->tva_rate / 100);
    }

    public function totalCentimes(): int
    {
        return $this->subtotalCentimes() + $this->tvaCentimes();
    }

    public function paidCentimes(): int
    {
        return $this->payments->reduce(
            fn (int $sum, Payment $payment) => $sum + (int) round((float) $payment->amount * 100),
            0,
        );
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }

    /**
     * Give an issued document its number: FAC-2026-0001, DEV-2026-0001.
     *
     * The count and the write race with each other, and the database is the
     * only thing that can settle it: (type, year, sequence) is unique, so
     * the loser of a tie is rejected rather than given a number that is
     * already on someone's invoice, and simply counts again.
     *
     * Each attempt is its own nested transaction — a savepoint — because a
     * failed statement in Postgres poisons the transaction it is in, and the
     * retry has to start from clean ground.
     */
    public function assignNumber(): void
    {
        $year = (int) ($this->issue_date?->year ?? now()->year);

        for ($attempt = 1; ; $attempt++) {
            $last = static::query()
                ->where('type', $this->type)
                ->where('year', $year)
                ->max('sequence');

            $this->sequence = (int) $last + 1;
            $this->year = $year;
            $this->number = sprintf(
                '%s-%d-%04d',
                $this->type === 'invoice' ? 'FAC' : 'DEV',
                $year,
                $this->sequence,
            );

            try {
                DB::transaction(fn () => $this->save());

                return;
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= 5) {
                    throw $e;
                }
            }
        }
    }
}
