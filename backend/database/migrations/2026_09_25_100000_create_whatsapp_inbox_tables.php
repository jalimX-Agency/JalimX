<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The WhatsApp inbox: who wrote to the agency's number, and every message
 * both ways.
 *
 * The number is on the Cloud API only — no phone has it open — so this is
 * the one place its messages can be read. A contact is a phone number, not
 * a client: most will be linked to one, found by their number, but someone
 * new can write before they are anyone's client.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_contacts', function (Blueprint $table) {
            $table->id();
            // WhatsApp's id for the person: their number, digits only.
            $table->string('wa_id', 20)->unique();
            // The name they set on WhatsApp, as Meta passes it on.
            $table->string('name', 190)->nullable();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            // Replying freely is allowed for 24 hours after this.
            $table->timestamp('last_inbound_at')->nullable();
            $table->unsignedInteger('unread')->default(0);
            $table->timestamps();

            $table->index('last_message_at');
        });

        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained('whatsapp_contacts')->cascadeOnDelete();
            // Meta's id for the message; how a delivery receipt finds it.
            $table->string('wamid', 191)->nullable()->unique();
            $table->string('direction', 3); // in | out
            // text, image, audio, video, document, sticker, location,
            // reaction, button, template, unsupported…
            $table->string('type', 20);
            $table->text('body')->nullable();
            // A file kept on the private disk, encrypted, when there is one.
            $table->string('media_path')->nullable();
            $table->string('media_mime', 100)->nullable();
            $table->string('media_name', 190)->nullable();
            $table->unsignedBigInteger('media_size')->nullable();
            // received for incoming; sent → delivered → read, or failed.
            $table->string('status', 12);
            $table->string('error', 500)->nullable();
            // The message this one answers or reacts to.
            $table->string('context_wamid', 191)->nullable();
            // What sent it, for ours: reply, invoice, logins, reminder, test.
            $table->string('source', 12)->nullable();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            // For a location: lat, lng, name, address. Kept small.
            $table->json('extra')->nullable();
            // When it was written, as WhatsApp says — not when it arrived here.
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->index(['contact_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('whatsapp_contacts');
    }
};
