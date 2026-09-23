<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Models\TaskReminder;
use App\Services\WhatsAppClient;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Runs every minute: finds every reminder whose moment has come and
 * sends it on WhatsApp, to the agency's own number.
 *
 * A reminder fires once its fire time (due minus its offset) has
 * passed, whichever minute that actually gets checked in — a cron that
 * was briefly down still sends it late rather than not at all. A task
 * marked done, deleted, or with its due date changed is excluded or
 * re-armed elsewhere (Task/TaskController); this command only sends
 * what is still due and unsent.
 */
class SendTaskReminders extends Command
{
    protected $signature = 'tasks:send-reminders';

    protected $description = 'Send any WhatsApp task reminders whose time has come';

    /** A broken template or token should not be hammered forever. */
    private const MAX_ATTEMPTS = 20;

    public function handle(): int
    {
        // Not container-resolved: the container would build an empty
        // instance from the constructor's optional, null-by-default
        // params instead of reading the actual credentials.
        $whatsapp = WhatsAppClient::fromConfig();

        if (! $whatsapp->configured()) {
            // Nothing to do without credentials — not an error, just unset up.
            return self::SUCCESS;
        }

        $now = Carbon::now();

        $due = TaskReminder::query()
            ->whereNull('sent_at')
            ->where('attempts', '<', self::MAX_ATTEMPTS)
            ->whereHas('task', fn ($q) => $q->whereNull('done_at')->whereNotNull('due_on'))
            ->with('task.engagement:id,title,client_id', 'task.client:id,name')
            ->get()
            ->filter(function (TaskReminder $reminder) use ($now) {
                $dueAt = $reminder->task?->dueAt();

                return $dueAt && $now->gte($dueAt->copy()->subMinutes($reminder->offset_minutes));
            });

        $sent = 0;
        foreach ($due as $reminder) {
            if ($this->send($whatsapp, $reminder)) {
                $sent++;
            }
        }

        if ($due->isNotEmpty()) {
            $this->info("{$sent}/{$due->count()} reminder(s) sent.");
        }

        return self::SUCCESS;
    }

    private function send(WhatsAppClient $whatsapp, TaskReminder $reminder): bool
    {
        $task = $reminder->task;

        try {
            $whatsapp->sendTemplate('jalimx_task_reminder', 'ar', [
                mb_substr($task->title, 0, 60),
                $this->when($task->dueAt(), $reminder->offset_minutes),
                $this->linkText($task) ?: '—',
            ]);

            $reminder->update(['sent_at' => now(), 'last_error' => null]);

            return true;
        } catch (\Throwable $e) {
            $reminder->increment('attempts');
            $reminder->update(['last_error' => mb_substr($e->getMessage(), 0, 500)]);
            $this->error("Task #{$task->id} reminder failed: {$e->getMessage()}");

            return false;
        }
    }

    /** "اليوم على الساعة 15:00", "غدا على الساعة 09:00", or the date further out. */
    private function when(Carbon $dueAt, int $offsetMinutes): string
    {
        $time = $dueAt->format('H:i');
        $days = Carbon::today()->diffInDays($dueAt->copy()->startOfDay(), false);

        $day = match (true) {
            $days === 0 => 'اليوم',
            $days === 1 => 'غدا',
            $days === -1 => 'البارح',
            default => $dueAt->translatedFormat('d/m'),
        };

        return $offsetMinutes === 0
            ? "الآن ({$day} - {$time})"
            : "{$day} على الساعة {$time}";
    }

    private function linkText(Task $task): string
    {
        $client = $task->relationLoaded('client') ? $task->client?->name : null;
        $work = $task->relationLoaded('engagement') ? $task->engagement?->title : null;

        return implode(' · ', array_filter([$client, $work]));
    }
}
