<?php

namespace App\Console\Commands;

use App\Models\TaskReminder;
use App\Services\ReminderSender;
use App\Services\WhatsAppClient;
use App\Support\TaskReminderMessage;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Runs on the scheduler: finds every reminder whose moment has come and
 * sends it on WhatsApp, to the agency's own number.
 *
 * A reminder fires once its fire time (due minus its offset) has
 * passed, whichever run actually checks — a cron that was briefly down
 * still sends it late rather than not at all. Done and deleted tasks are
 * left out; a task whose due date moved has its reminders re-armed by the
 * controller, not here.
 */
class SendTaskReminders extends Command
{
    protected $signature = 'tasks:send-reminders';

    protected $description = 'Send any WhatsApp task reminders whose time has come';

    /** A broken template or token should not be hammered forever. */
    private const MAX_ATTEMPTS = 20;

    public function handle(): int
    {
        $whatsapp = WhatsAppClient::fromConfig();

        if (! $whatsapp->configured()) {
            // Nothing to do without credentials — not an error, just not set up.
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
            })
            // One message per task per run, even if two of its offsets came
            // due together (the cron was down, or the date was just moved).
            ->groupBy('task_id');

        if ($due->isEmpty()) {
            return self::SUCCESS;
        }

        $sender = new ReminderSender($whatsapp);
        $sent = 0;

        foreach ($due as $reminders) {
            $task = $reminders->first()->task;

            try {
                $message = TaskReminderMessage::for($task, $now);
                $used = $sender->send($message['key'], $message['params']);

                TaskReminder::query()->whereKey($reminders->pluck('id'))
                    ->update(['sent_at' => now(), 'last_error' => null]);
                $sent++;
                $this->line("Task #{$task->id}: sent with {$used}.");
            } catch (\Throwable $e) {
                foreach ($reminders as $reminder) {
                    $reminder->increment('attempts');
                    $reminder->update(['last_error' => mb_substr($e->getMessage(), 0, 500)]);
                }
                $this->error("Task #{$task->id}: {$e->getMessage()}");
            }
        }

        $this->info("{$sent}/{$due->count()} task reminder(s) sent.");

        return self::SUCCESS;
    }
}
