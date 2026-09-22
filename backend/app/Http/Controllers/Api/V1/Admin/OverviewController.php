<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Client;
use App\Models\Document;
use App\Models\Engagement;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * The first screen: what needs doing, and what is owed.
 *
 * One request, because a dashboard that fires eight is a dashboard that
 * loads in pieces over a connection like this one. The sums are done in
 * PHP over eager-loaded rows rather than in SQL: the same centime
 * arithmetic the invoice itself uses, so the figure here and the figure on
 * the document can never drift apart. That is affordable while the agency
 * has tens of invoices, and would not be at tens of thousands.
 */
class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $now = Carbon::now();

        return response()->json([
            'data' => [
                'money' => $this->money($now),
                'unbilled' => $this->unbilledMonths($now),
                'overdue' => $this->overdue($now),
                'drafts' => $this->drafts(),
                'tasks' => $this->tasksDue($now),
                'leads' => $this->leads(),
                'counts' => $this->counts(),
                'as_of' => $now->toIso8601String(),
            ],
        ]);
    }

    /**
     * Money, grouped by currency.
     *
     * Grouped because adding dirhams to euros gives a number that is true
     * of nothing. Almost always there is one row.
     *
     * @return array<int, array<string, mixed>>
     */
    private function money(Carbon $now): array
    {
        $invoices = Document::query()
            ->where('type', 'invoice')
            ->whereIn('status', ['sent'])
            ->with('items', 'payments')
            ->get();

        $totals = [];
        $add = function (string $currency, string $key, int $centimes) use (&$totals) {
            $totals[$currency] ??= ['outstanding' => 0, 'overdue' => 0, 'paid_this_month' => 0, 'recurring' => 0];
            $totals[$currency][$key] += $centimes;
        };

        foreach ($invoices as $invoice) {
            $due = $invoice->totalCentimes() - $invoice->paidCentimes();

            if ($due <= 0) {
                continue;
            }

            $add($invoice->currency, 'outstanding', $due);

            if ($invoice->due_date !== null && $invoice->due_date->isBefore($now->copy()->startOfDay())) {
                $add($invoice->currency, 'overdue', $due);
            }
        }

        // Paid this month is about when the money arrived, not when the
        // invoice was written: it is the answer to "what came in".
        $payments = Payment::query()
            ->whereBetween('paid_on', [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()])
            ->with('document:id,currency')
            ->get();

        foreach ($payments as $payment) {
            $add(
                (string) ($payment->document?->currency ?? 'MAD'),
                'paid_this_month',
                (int) round((float) $payment->amount * 100),
            );
        }

        // What comes in every month if nothing changes.
        $retainers = Engagement::query()
            ->where('billing', 'monthly')
            ->where('status', 'active')
            ->with('client:id,currency')
            ->get();

        foreach ($retainers as $retainer) {
            $add(
                (string) ($retainer->client?->currency ?? 'MAD'),
                'recurring',
                (int) round((float) ($retainer->budget ?? 0) * 100),
            );
        }

        /*
         * A day with no invoices still needs the shape of the page: four
         * zeroes say "nothing yet", an empty space says the page is
         * broken. The currency comes from the clients, or the default.
         */
        if ($totals === []) {
            $currency = (string) (Client::query()->value('currency') ?? 'MAD');
            $totals[$currency] = ['outstanding' => 0, 'overdue' => 0, 'paid_this_month' => 0, 'recurring' => 0];
        }

        return collect($totals)
            ->map(fn (array $sums, string $currency) => [
                'currency' => $currency,
                ...collect($sums)->map(fn (int $c) => DocumentResource::amount($c))->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * Months of a retainer that have not been invoiced.
     *
     * Looks back six months and no further: a year-old gap is not
     * something a reminder on a dashboard is going to fix, and a list that
     * grows forever stops being read.
     *
     * @return array<int, array<string, mixed>>
     */
    private function unbilledMonths(Carbon $now): array
    {
        $retainers = Engagement::query()
            ->where('billing', 'monthly')
            ->where('status', 'active')
            ->with('client:id,name,currency')
            ->get();

        $billed = Document::query()
            ->whereNotNull('period')
            ->where('status', '!=', 'cancelled')
            ->get(['engagement_id', 'period'])
            // A cancelled invoice does not count: that month is owed again.
            ->map(fn (Document $d) => $d->engagement_id.'|'.$d->period->toDateString())
            ->flip();

        $out = [];

        foreach ($retainers as $retainer) {
            $start = $retainer->starts_on?->copy()->startOfMonth() ?? $now->copy()->startOfMonth();
            $floor = $now->copy()->startOfMonth()->subMonths(5);
            $from = $start->greaterThan($floor) ? $start : $floor;

            for ($month = $from->copy(); $month->lessThanOrEqualTo($now->copy()->startOfMonth()); $month->addMonth()) {
                $key = $retainer->id.'|'.$month->toDateString();

                if ($billed->has($key)) {
                    continue;
                }

                $out[] = [
                    'engagement_id' => $retainer->id,
                    'client_id' => $retainer->client_id,
                    'client' => (string) ($retainer->client?->name ?? ''),
                    'title' => (string) $retainer->title,
                    'period' => $month->toDateString(),
                    'amount' => $retainer->budget !== null ? (string) $retainer->budget : null,
                    'currency' => (string) ($retainer->client?->currency ?? 'MAD'),
                ];
            }
        }

        // Oldest first: the month you forgot matters more than this one.
        usort($out, fn ($a, $b) => $a['period'] <=> $b['period']);

        return $out;
    }

    /** @return array<int, array<string, mixed>> */
    private function overdue(Carbon $now): array
    {
        return Document::query()
            ->where('type', 'invoice')
            ->where('status', 'sent')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $now->toDateString())
            ->with('items', 'payments', 'client:id,name')
            ->get()
            ->filter(fn (Document $d) => $d->totalCentimes() - $d->paidCentimes() > 0)
            ->map(fn (Document $d) => [
                'id' => $d->id,
                'number' => $d->number,
                'client_id' => $d->client_id,
                'client' => (string) ($d->client?->name ?? ''),
                'due_date' => $d->due_date?->toDateString(),
                'days_late' => $d->due_date ? $d->due_date->diffInDays($now->copy()->startOfDay()) : 0,
                'due' => DocumentResource::amount($d->totalCentimes() - $d->paidCentimes()),
                'currency' => (string) $d->currency,
            ])
            ->sortByDesc('days_late')
            ->values()
            ->all();
    }

    /**
     * Open tasks that are late or due within the week, across every
     * client. Undated tasks are left out on purpose: they are "some day",
     * and a list that includes some day never gets short enough to finish.
     *
     * @return array<int, array<string, mixed>>
     */
    private function tasksDue(Carbon $now): array
    {
        $today = $now->copy()->startOfDay();

        return Task::query()
            ->whereNull('done_at')
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<=', $today->copy()->addDays(7)->toDateString())
            ->with('engagement:id,title', 'client:id,name')
            ->orderBy('due_on')
            // Within a day, the urgent ones first.
            ->orderByRaw("case priority when 'high' then 0 when 'normal' then 1 else 2 end")
            ->orderBy('id')
            ->limit(30)
            ->get()
            ->map(fn (Task $task) => [
                'id' => $task->id,
                'title' => (string) $task->title,
                'due_on' => $task->due_on->toDateString(),
                // Negative when late, zero today, positive ahead.
                'days' => (int) $today->diffInDays($task->due_on, false),
                'status' => (string) $task->status,
                'priority' => (string) $task->priority,
                'progress' => (int) $task->progress,
                // All three may be empty: a task can stand on its own.
                'engagement_id' => $task->engagement_id,
                'work' => $task->engagement?->title,
                'client_id' => $task->client_id,
                'client' => $task->client?->name,
            ])
            ->all();
    }

    /** Written but never sent — the pile that quietly costs money. */
    private function drafts(): array
    {
        return Document::query()
            ->where('status', 'draft')
            ->with('items', 'client:id,name')
            ->latest('id')
            ->get()
            ->map(fn (Document $d) => [
                'id' => $d->id,
                'type' => (string) $d->type,
                'client_id' => $d->client_id,
                'client' => (string) ($d->client?->name ?? ''),
                'subject' => $d->subject,
                'total' => DocumentResource::amount($d->totalCentimes()),
                'currency' => (string) $d->currency,
                'created_at' => $d->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    private function leads(): array
    {
        return [
            'unread' => Lead::whereNull('read_at')->count(),
            'recent' => Lead::query()
                ->latest()
                ->limit(5)
                ->get(['id', 'name', 'company', 'status', 'read_at', 'created_at'])
                ->map(fn (Lead $lead) => [
                    'id' => $lead->id,
                    'name' => (string) $lead->name,
                    'company' => $lead->company,
                    'status' => (string) $lead->status,
                    'is_read' => $lead->read_at !== null,
                    'created_at' => $lead->created_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }

    /** @return array<string, int> */
    private function counts(): array
    {
        return [
            'clients' => Client::count(),
            // Without an ICE a Moroccan invoice is not compliant, so this
            // is the one missing field worth counting.
            'clients_without_ice' => Client::whereNull('ice')->orWhere('ice', '')->count(),
            'active_work' => Engagement::where('status', 'active')->count(),
            'planned_work' => Engagement::where('status', 'planned')->count(),
        ];
    }
}
