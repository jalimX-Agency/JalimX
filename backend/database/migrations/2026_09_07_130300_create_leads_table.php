<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();

            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('company')->nullable();

            $table->string('budget_range')->nullable();
            $table->string('service_interest')->nullable();
            $table->text('message');

            $table->string('status')->default('new'); // new | contacted | quoted | won | lost
            $table->string('locale', 5)->default('en');
            $table->string('source')->nullable();     // contact-form, service page, ...
            $table->ipAddress('ip')->nullable();

            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
