<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'tagline' => [
                'en' => 'Made, not assembled',
                'fr' => 'Conçu, pas assemblé',
            ],

            /*
             * The homepage headline is the approved tagline. It reads to a villa
             * owner as readily as to a developer - handmade against flat-pack -
             * which is exactly what the homepage audience needs.
             */
            'hero_headline' => [
                'en' => 'Made, not assembled',
                'fr' => 'Conçu, pas assemblé',
            ],
            'hero_body' => [
                'en' => 'We build websites from an empty file — no templates, no '
                    .'page builders. That is why they load fast, read the way you '
                    .'sound, and do exactly what they were built to do.',
                'fr' => 'Nous construisons des sites à partir d\'un fichier vide — '
                    .'sans gabarit ni page builder. C\'est pourquoi ils sont '
                    .'rapides, sonnent juste, et font exactement ce pour quoi ils '
                    .'ont été conçus.',
            ],

            /*
             * Location is deliberately absent from every piece of positioning
             * copy and appears only here, for the footer and the contact page.
             * The decision and its cost are written up in PLAN.md section 9.
             *
             * Phone is still blank — add it when there is one to publish.
             */
            'contact_email' => ['value' => 'contact@jalimx.com'],
            'contact_phone' => ['value' => ''],
            'contact_location' => ['value' => 'Marrakech, Morocco'],

            'social' => [
                'instagram' => '',
                'linkedin' => '',
                'github' => '',
            ],
            'locales' => ['en', 'fr'],
        ];

        foreach ($settings as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
