<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The businesses JalimX works for.
     *
     * Distinct from `leads`, which is anyone who filled in a form, and from
     * `projects`, which is a published case study. A client is a real
     * counterparty: the name that goes on an invoice, the person you call.
     */
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();

            // How you refer to them day to day.
            $table->string('name');

            /*
             * The legal identity, which is what an invoice needs and is often
             * not what anyone calls them ("SARL Globale Explore" vs "Globale").
             * Nullable: a small client may have no registered company at all.
             */
            $table->string('legal_name')->nullable();
            $table->string('ice', 20)->nullable();   // Moroccan company ID, required on invoices

            // Who you actually talk to.
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('website')->nullable();

            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->default('Morocco');

            // Per-client, because an invoice is issued in one currency and a
            // foreign client may not be billed in dirhams.
            $table->string('currency', 3)->default('MAD');

            $table->text('notes')->nullable();

            /*
             * Where they came from. Kept even if the lead is later deleted —
             * losing the client because its lead was tidied away would be
             * absurd, so this nulls rather than cascades.
             */
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamps();

            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
