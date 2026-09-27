<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A discount on the whole quote or invoice — "Remise" — taken off the
 * untaxed total before VAT, the way a Moroccan invoice shows it.
 *
 * Kept as what was agreed (10 %, or 500 MAD) rather than as the amount it
 * came to: the amount follows from the lines, and storing it would give it
 * a chance to disagree with them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('discount_type', 10)->nullable()->after('tva_rate'); // percent | amount
            $table->decimal('discount_value', 12, 2)->nullable()->after('discount_type');
            $table->string('discount_label', 120)->nullable()->after('discount_value');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['discount_type', 'discount_value', 'discount_label']);
        });
    }
};
