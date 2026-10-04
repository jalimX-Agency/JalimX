<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a retainer's month is paid: at the end of it, once the work is done
 * (the default), or at its start, in advance. Months run from the day the
 * work started — the 27th to the 27th — not from the 1st.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('engagements', function (Blueprint $table) {
            $table->string('payment_timing', 5)->default('end')->after('billing'); // end | start
        });
    }

    public function down(): void
    {
        Schema::table('engagements', function (Blueprint $table) {
            $table->dropColumn('payment_timing');
        });
    }
};
