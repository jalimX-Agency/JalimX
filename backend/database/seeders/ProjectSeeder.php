<?php

namespace Database\Seeders;

use App\Models\Project;
use Illuminate\Database\Seeder;

/**
 * Real clients, factual scope.
 *
 * Descriptions cover what the live sites demonstrably do — every claim here was
 * checked against the site itself. `outcome` and `metrics` stay empty: results
 * are Mohamed's to supply and verify. Seeding invented numbers into a portfolio
 * would be the one unrecoverable mistake on a page whose whole job is to be
 * believed.
 *
 * `is_featured` means "there is a live site and a screenshot of it". Everything
 * published without one still belongs on /work, just not on the homepage.
 */
class ProjectSeeder extends Seeder
{
    public function run(): void
    {
        $projects = [
            [
                'slug' => 'globale-explore-tours',
                'client_name' => 'Globale Explore Tours',
                'year' => 2026,
                'is_featured' => true,
                'project_url' => 'https://www.globaleexploretours.com',
                'tags' => ['web', 'booking', 'seo'],
                'stack' => ['Next.js', 'Laravel', 'PostgreSQL'],
                'title' => [
                    'en' => 'A tour catalogue that takes bookings',
                    'fr' => 'Un catalogue de circuits qui prend les réservations',
                ],
                'summary' => [
                    'en' => 'A trilingual catalogue and booking-request site for a '
                        .'tour operator running day trips and multi-day circuits.',
                    'fr' => 'Un site catalogue trilingue avec demande de réservation '
                        .'pour un tour-opérateur proposant excursions et circuits.',
                ],
                'challenge' => [
                    'en' => 'The operator sells in three languages and holds a 4.9 '
                        .'rating from 105 TripAdvisor reviews — first of 92 in its '
                        .'category. None of that reputation reached the website, and '
                        .'every tour edit needed a developer.',
                    'fr' => 'L\'agence vend en trois langues et affiche 4,9 sur '
                        .'TripAdvisor pour 105 avis — première sur 92 dans sa '
                        .'catégorie. Rien de cette réputation n\'apparaissait sur le '
                        .'site, et chaque modification exigeait un développeur.',
                ],
                'solution' => [
                    'en' => 'A catalogue in FR/EN/ES with a booking-request flow, '
                        .'backed by a dashboard where tours, prices, images, '
                        .'translations and incoming requests are all editable '
                        .'without touching code. Local SEO and the Google Business '
                        .'Profile were part of the build, not an afterthought.',
                    'fr' => 'Un catalogue en FR/EN/ES avec un parcours de demande de '
                        .'réservation, adossé à un tableau de bord où circuits, '
                        .'tarifs, images, traductions et demandes se modifient sans '
                        .'toucher au code. Le SEO local et le profil Google Business '
                        .'faisaient partie du chantier.',
                ],
            ],
            [
                'slug' => 'arabian-desert-home',
                'client_name' => 'Arabian Desert Home',
                'year' => 2026,
                'is_featured' => true,
                'project_url' => 'https://www.arabiandeserthome.ma',
                'tags' => ['web', 'booking', 'content'],
                'stack' => [],
                'title' => [
                    'en' => 'A desert camp, sold a night at a time',
                    'fr' => 'Un camp du désert, vendu nuit par nuit',
                ],
                'summary' => [
                    'en' => 'Website and content programme for a luxury desert camp — '
                        .'tents, restaurant, activities and day passes, each bookable '
                        .'in its own right.',
                    'fr' => 'Site web et programme de contenu pour un bivouac de luxe '
                        .'— tentes, restaurant, activités et day pass, chacun '
                        .'réservable séparément.',
                ],
                'challenge' => [
                    'en' => 'The camp photographs beautifully and still has to compete '
                        .'with every other desert camp posting the same sunset. It '
                        .'also sells several different things — a night, a dinner, a '
                        .'day pass, a private event — that a single "book now" button '
                        .'flattens into one.',
                    'fr' => 'Le camp est photogénique — et doit malgré tout se '
                        .'distinguer de tous les autres camps qui postent le même '
                        .'coucher de soleil. Il vend aussi plusieurs choses — une '
                        .'nuit, un dîner, un day pass, un événement privé — qu\'un '
                        .'seul bouton « réserver » réduit à une seule.',
                ],
                'solution' => [
                    'en' => 'A bilingual site that gives each offer its own route and '
                        .'its own booking path, rather than funnelling everything '
                        .'through one form. Alongside it, a running content programme '
                        .'— shot briefs, scripted Reels and campaign templates built '
                        .'around those same specific offers instead of generic scenery.',
                    'fr' => 'Un site bilingue qui donne à chaque offre sa propre page '
                        .'et son propre parcours de réservation, au lieu de tout faire '
                        .'passer par un formulaire unique. En parallèle, un programme '
                        .'de contenu suivi — briefs de tournage, Reels scriptés et '
                        .'modèles de campagne construits autour de ces mêmes offres '
                        .'plutôt que sur du paysage générique.',
                ],
            ],
            [
                'slug' => 'families-tours',
                'client_name' => 'Families Tours',
                'year' => 2026,
                'is_featured' => true,
                'project_url' => 'https://www.familiestours.com',
                'tags' => ['web', 'booking'],
                'stack' => [],
                'title' => [
                    'en' => 'Desert tours, written for families',
                    'fr' => 'Des circuits du désert, pensés pour les familles',
                ],
                'summary' => [
                    'en' => 'A bilingual site for a desert tour operator whose whole '
                        .'offer is built around families rather than solo travellers.',
                    'fr' => 'Un site bilingue pour un organisateur d\'excursions dont '
                        .'toute l\'offre est pensée pour les familles.',
                ],
                'challenge' => [
                    'en' => 'Desert tour listings all read the same. A family booking '
                        .'for four needs to know different things from a backpacker — '
                        .'and none of the usual templates make room for that.',
                    'fr' => 'Toutes les annonces d\'excursions se ressemblent. Une '
                        .'famille de quatre a besoin d\'autres informations qu\'un '
                        .'routard — et aucun gabarit habituel ne laisse la place pour ça.',
                ],
                'solution' => [
                    'en' => 'Experiences, gallery and reservation built as separate '
                        .'routes so a visitor can browse the way they actually decide, '
                        .'with a language switcher and a light and dark mode carried '
                        .'through the whole site.',
                    'fr' => 'Expériences, galerie et réservation construites comme des '
                        .'parcours distincts, pour que le visiteur navigue comme il '
                        .'décide vraiment — avec sélecteur de langue et modes clair et '
                        .'sombre sur tout le site.',
                ],
            ],
            [
                'slug' => 'villa-serena',
                'client_name' => 'Villa Serena',
                'year' => 2026,
                'is_featured' => false, // no live site to screenshot yet
                'tags' => ['web', 'brand'],
                'stack' => ['Next.js'],
                'title' => [
                    'en' => 'A private villa, presented as one',
                    'fr' => 'Une villa privée, présentée comme telle',
                ],
                'summary' => [
                    'en' => 'Design system and website for a private villa.',
                    'fr' => 'Design system et site web pour une villa privée.',
                ],
                'challenge' => [
                    'en' => 'A villa competes on atmosphere, and atmosphere is the '
                        .'first thing a generic booking template flattens.',
                    'fr' => 'Une villa se vend sur une atmosphère — et l\'atmosphère '
                        .'est la première chose qu\'un gabarit de réservation écrase.',
                ],
                'solution' => [
                    'en' => 'A documented design system — type, colour, spacing and '
                        .'components — written before any page, then a site built '
                        .'strictly on it, so every screen reads as the same property.',
                    'fr' => 'Un design system documenté — typographie, couleurs, '
                        .'espacements, composants — écrit avant toute page, puis un '
                        .'site construit strictement dessus, pour que chaque écran '
                        .'parle de la même propriété.',
                ],
            ],
            [
                'slug' => 'hs-luxury-quads',
                'client_name' => 'HS Luxury Quads',
                'year' => 2026,
                'is_featured' => false, // no live site to screenshot yet
                'tags' => ['web'],
                'stack' => [],
                'title' => [
                    'en' => 'Quad tours, booked online',
                    'fr' => 'Excursions en quad, réservées en ligne',
                ],
                'summary' => [
                    'en' => 'Website for a quad-biking tour operator.',
                    'fr' => 'Site web pour un organisateur d\'excursions en quad.',
                ],
            ],
        ];

        foreach ($projects as $i => $project) {
            Project::updateOrCreate(
                ['slug' => $project['slug']],
                [
                    ...$project,
                    'position' => $i,
                    'is_published' => true,
                    'published_at' => now(),
                ]
            );
        }
    }
}
