<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            [
                'slug' => 'web-development',
                'icon' => 'code',
                'title' => [
                    'en' => 'Web Development',
                    'fr' => 'Développement web',
                ],
                'tagline' => [
                    'en' => 'Sites built from an empty file, not a template.',
                    'fr' => 'Des sites partis d\'un fichier vide, pas d\'un gabarit.',
                ],
                'body' => [
                    'en' => 'Marketing sites, booking flows and admin dashboards, '
                        .'built on Next.js and Laravel. Every project starts from '
                        .'scratch, so nothing ships that the site does not need — '
                        .'which is most of why they load fast.',
                    'fr' => 'Sites vitrines, parcours de réservation et tableaux de '
                        .'bord, construits avec Next.js et Laravel. Chaque projet part '
                        .'de zéro : rien n\'est livré dont le site n\'a pas besoin — '
                        .'c\'est l\'essentiel de la raison pour laquelle ils sont rapides.',
                ],
            ],
            [
                'slug' => 'brand-identity',
                'icon' => 'shapes',
                'title' => [
                    'en' => 'Brand & Identity',
                    'fr' => 'Identité de marque',
                ],
                'tagline' => [
                    'en' => 'A logo is the start, not the deliverable.',
                    'fr' => 'Un logo est le début, pas le livrable.',
                ],
                'body' => [
                    'en' => 'Logo systems, type and colour, and the rules that keep '
                        .'them consistent — delivered as vector files and a written '
                        .'guide, so the identity survives the next person who touches it.',
                    'fr' => 'Systèmes de logo, typographie et couleurs, et les règles '
                        .'qui les tiennent cohérents — livrés en fichiers vectoriels '
                        .'avec un guide écrit, pour que l\'identité survive à la '
                        .'prochaine personne qui y touche.',
                ],
            ],
            [
                'slug' => 'content-social',
                'icon' => 'play',
                'title' => [
                    'en' => 'Content & Social',
                    'fr' => 'Contenu & réseaux sociaux',
                ],
                'tagline' => [
                    'en' => 'Reels, scripts and campaigns that sound like the business.',
                    'fr' => 'Reels, scripts et campagnes qui sonnent juste.',
                ],
                'body' => [
                    'en' => 'Content plans, shot briefs, Reel scripts and campaign '
                        .'templates for hospitality and tourism brands — written for '
                        .'the platform they run on and the guest they are talking to.',
                    'fr' => 'Plans de contenu, briefs de tournage, scripts de Reels et '
                        .'modèles de campagne pour l\'hôtellerie et le tourisme — '
                        .'écrits pour la plateforme visée et pour le client final.',
                ],
            ],
            [
                'slug' => 'seo-growth',
                'icon' => 'trending',
                'title' => [
                    'en' => 'SEO & Growth',
                    'fr' => 'SEO & croissance',
                ],
                'tagline' => [
                    'en' => 'Found by the people already looking for you.',
                    'fr' => 'Trouvé par ceux qui vous cherchent déjà.',
                ],
                'body' => [
                    'en' => 'Technical SEO, local search and Google Business Profile, '
                        .'plus the analytics to tell whether any of it worked. Built '
                        .'into the site rather than bolted on afterwards.',
                    'fr' => 'SEO technique, référencement local et Google Business '
                        .'Profile, avec l\'analytique pour savoir si ça a marché. '
                        .'Intégré au site, pas ajouté après coup.',
                ],
            ],
        ];

        foreach ($services as $i => $service) {
            Service::updateOrCreate(
                ['slug' => $service['slug']],
                [...$service, 'position' => $i, 'is_published' => true]
            );
        }
    }
}
