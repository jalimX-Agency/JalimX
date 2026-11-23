<?php

namespace App\Support;

/**
 * Everything a role can be allowed to do in the dashboard.
 *
 * The owner builds roles from this list on the Team page. A permission is
 * checked by the API on every route (routes/api.php), not only by hiding a
 * button, so a role that cannot see money gets no money from the API at all.
 *
 * Adding a permission here and to a route is all it takes: the `owner` role
 * passes every check (AppServiceProvider), so nothing the owner could do
 * before stops working.
 */
final class Permissions
{
    public const OWNER_ROLE = 'owner';

    /** @var array<string, array{label: string, items: array<string, array{label: string, hint: string}>}> */
    public const GROUPS = [
        'clients' => [
            'label' => 'Clients & work',
            'items' => [
                'clients.view' => ['label' => 'See clients', 'hint' => 'The client list, their details and their work.'],
                'clients.manage' => ['label' => 'Add and edit clients', 'hint' => 'Create, edit and delete clients, their work and files.'],
            ],
        ],
        'money' => [
            'label' => 'Money',
            'items' => [
                'money.view' => ['label' => 'See money', 'hint' => 'Invoices, quotes, payments and the figures on Today.'],
                'money.manage' => ['label' => 'Manage invoices and payments', 'hint' => 'Write, issue, send and delete invoices; record payments.'],
            ],
        ],
        'logins' => [
            'label' => 'Client logins',
            'items' => [
                'logins.view' => ['label' => 'See the list of logins', 'hint' => 'Names, addresses and usernames, never the passwords.'],
                'logins.reveal' => ['label' => 'Show and send passwords', 'hint' => 'Show or copy a password, and send the logins PDF.'],
                'logins.manage' => ['label' => 'Add and edit logins', 'hint' => 'Create, change and delete logins.'],
            ],
        ],
        'leads' => [
            'label' => 'Leads',
            'items' => [
                'leads.view' => ['label' => 'See leads', 'hint' => 'Enquiries from the contact form.'],
                'leads.manage' => ['label' => 'Answer and manage leads', 'hint' => 'Reply, change status, add notes, convert or delete.'],
            ],
        ],
        'inbox' => [
            'label' => 'WhatsApp inbox',
            'items' => [
                'inbox.view' => ['label' => 'Read conversations', 'hint' => 'The WhatsApp conversations on the business number.'],
                'inbox.reply' => ['label' => 'Reply on WhatsApp', 'hint' => 'Send messages from the business number.'],
                'inbox.unlinked' => ['label' => 'See conversations not linked to a client', 'hint' => 'Only matters for a role limited to assigned clients: new numbers nobody has linked yet.'],
            ],
        ],
        'tasks' => [
            'label' => 'Tasks',
            'items' => [
                'tasks.view' => ['label' => 'See tasks', 'hint' => 'The task list and board.'],
                'tasks.manage' => ['label' => 'Add and change tasks', 'hint' => 'Create, edit, complete and delete tasks.'],
            ],
        ],
        'site' => [
            'label' => 'Website',
            'items' => [
                'site.manage' => ['label' => 'Edit the public site', 'hint' => 'Homepage words, services, case studies and testimonials.'],
            ],
        ],
        'settings' => [
            'label' => 'Settings',
            'items' => [
                'settings.manage' => ['label' => 'Change settings', 'hint' => 'Invoicing details, work types, task templates and WhatsApp.'],
                'team.manage' => ['label' => 'Manage the team', 'hint' => 'Invite people, create roles and choose what they can do.'],
            ],
        ],
        'ai' => [
            'label' => 'AI',
            'items' => [
                'ai.use' => ['label' => 'Use the writing help', 'hint' => 'AI drafts and suggestions in forms.'],
                'ai.manage' => ['label' => 'Manage AI keys', 'hint' => 'Add, test and remove AI provider keys.'],
            ],
        ],
    ];

    /** @return list<string> */
    public static function all(): array
    {
        $names = [];
        foreach (self::GROUPS as $group) {
            foreach (array_keys($group['items']) as $name) {
                $names[] = $name;
            }
        }

        return $names;
    }

    /** The catalogue as the Team page draws it. */
    public static function catalog(): array
    {
        return collect(self::GROUPS)->map(fn ($group, $key) => [
            'key' => $key,
            'label' => $group['label'],
            'items' => collect($group['items'])->map(fn ($item, $name) => [
                'name' => $name,
                'label' => $item['label'],
                'hint' => $item['hint'],
            ])->values()->all(),
        ])->values()->all();
    }
}
