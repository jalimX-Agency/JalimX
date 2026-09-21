<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quotes and invoices. One table, because they are the same document at two
 * moments of its life: a devis becomes a facture with a different number and
 * a due date, and keeping them apart would mean copying every line twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            /*
             * Restricted, not cascaded: an invoice is a record of money, and
             * deleting a client should not quietly erase what they were
             * billed. The dashboard explains the refusal instead.
             */
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('engagement_id')->nullable()->constrained()->nullOnDelete();

            $table->string('type', 10);   // quote | invoice
            $table->string('status', 12)->default('draft');

            /*
             * Assigned when the document is issued, never before: a number
             * handed to a draft that is then deleted leaves a hole in the
             * sequence, and a sequence with holes is the first thing an
             * inspector asks about.
             */
            $table->string('number', 30)->nullable()->unique();
            $table->unsignedInteger('sequence')->nullable();
            $table->unsignedSmallInteger('year')->nullable();

            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();

            $table->string('currency', 3)->default('MAD');
            // Zero by default: JalimX is not VAT registered yet. The field
            // exists so the day it is, nothing has to be rebuilt.
            $table->decimal('tva_rate', 5, 2)->default(0);

            $table->string('subject', 190)->nullable();
            $table->text('notes')->nullable();
            $table->text('terms')->nullable();

            /*
             * Who it was billed to and by, frozen at issue. A client who
             * moves office next year must not silently rewrite last year's
             * invoice.
             */
            $table->json('bill_to')->nullable();
            $table->json('issued_by')->nullable();

            $table->timestamps();

            $table->index(['client_id', 'type']);
            $table->unique(['type', 'year', 'sequence']);
        });

        Schema::create('document_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('description', 500);
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['document_id', 'position']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('paid_on');
            $table->string('method', 20)->default('transfer');
            $table->string('reference', 120)->nullable();
            $table->timestamps();

            $table->index('document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('document_items');
        Schema::dropIfExists('documents');
    }
};
