<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The AI credential pool, and a log of what it was asked to do.
 *
 * One row per API key, not per provider: the same provider can hold several
 * keys (Gemini #1, Gemini #2…), each with its own model, priority and state.
 * The key itself is encrypted with APP_KEY by the model's cast; `key_hint`
 * keeps the last four characters in the clear so the dashboard can show
 * which key is which without ever decrypting one to mask it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('label', 80);
            $table->string('provider', 40);
            $table->string('model', 160);
            // Only for providers that take an address (OpenAI-compatible).
            $table->string('base_url')->nullable();
            $table->text('api_key');
            $table->string('key_hint', 8);

            $table->string('status', 20)->default('active');
            $table->unsignedSmallInteger('priority')->default(0);
            // Not chosen before this moment: set when a provider says "slow down".
            $table->timestamp('available_at')->nullable();
            // How many rate limits in a row — each one waits longer.
            $table->unsignedTinyInteger('cooldown_step')->default(0);
            $table->unsignedSmallInteger('consecutive_failures')->default(0);

            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_error_at')->nullable();
            $table->string('last_error_type', 20)->nullable();
            // Already cleaned of anything key-shaped before it is written.
            $table->string('last_error_note', 300)->nullable();

            $table->timestamps();

            $table->index(['status', 'priority']);
        });

        /*
         * What happened, not what was said: no prompt and no answer is
         * stored. Enough to see which key is spending its quota on what.
         */
        Schema::create('ai_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_credential_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('task', 40);
            $table->string('outcome', 20); // ok | error
            $table->string('error_type', 20)->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->unsignedInteger('tokens_in')->nullable();
            $table->unsignedInteger('tokens_out')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['ai_credential_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_requests');
        Schema::dropIfExists('ai_credentials');
    }
};
