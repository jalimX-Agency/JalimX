<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\Facades\Validator;

/**
 * Creates or updates the dashboard account.
 *
 * Interactive, and the password is typed rather than passed as an argument:
 * an argument lands in the shell history, in the process list while it runs,
 * and in whatever transcript the terminal belongs to. Asking for it means the
 * only place it exists is the hash in the database.
 *
 *   php artisan jalimx:admin
 */
class MakeAdmin extends Command
{
    protected $signature = 'jalimx:admin {--email=}';

    protected $description = 'Create or update the dashboard account';

    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('Email');
        $name = $this->ask('Name', 'JalimX');

        $password = $this->secret('Password');
        $confirm = $this->secret('Confirm password');

        if ($password !== $confirm) {
            $this->error('The passwords do not match.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['email' => $email, 'name' => $name, 'password' => $password],
            [
                'email' => ['required', 'email'],
                'name' => ['required', 'string', 'max:120'],
                /*
                 * Checked against Have I Been Pwned's list of breached
                 * passwords. This is the one account that can rewrite every
                 * page on the site, and a password already circulating in a
                 * dump is the likeliest way it gets taken.
                 */
                'password' => ['required', Password::min(12)->uncompromised()],
            ]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => Hash::make($password)]
        );

        $this->info(($user->wasRecentlyCreated ? 'Created' : 'Updated').": {$user->email}");

        return self::SUCCESS;
    }
}
