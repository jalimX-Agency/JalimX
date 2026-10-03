<?php

namespace App\Console\Commands;

use App\Models\Project;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Bring the live-site screenshots that `pnpm capture:work` wrote into the
 * dashboard's media library.
 *
 * Until now they only existed as static files in the frontend's public/work
 * folder, so the dashboard could not show, replace or remove them. Importing
 * attaches each one to its project's capture collection; the files on disk
 * are copied, never moved.
 *
 *   php artisan projects:import-captures
 *   php artisan projects:import-captures --force   replace what is attached
 *   php artisan projects:import-captures --url=https://jalimx.com/work
 *
 * The backend is deployed on its own, without the frontend's folder, so on a
 * server pass --url and the files are downloaded from the live site instead.
 */
class ImportWorkCaptures extends Command
{
    protected $signature = 'projects:import-captures
        {--path= : The frontend public/work folder (defaults to ../frontend/public/work)}
        {--url= : Download from this public/work URL on the live site instead of a folder}
        {--force : Replace captures that are already in the dashboard}';

    protected $description = 'Attach the captured live-site screenshots to their case studies';

    public function handle(): int
    {
        $url = rtrim((string) $this->option('url'), '/');
        $dir = rtrim($this->option('path') ?: base_path('../frontend/public/work'), '/');

        if ($url !== '') {
            $response = Http::timeout(30)->get($url.'/manifest.json');

            if (! $response->successful()) {
                $this->error("Could not download {$url}/manifest.json (HTTP {$response->status()}).");

                return self::FAILURE;
            }

            $shots = $response->json('shots') ?? [];
        } else {
            $manifest = $dir.'/manifest.json';

            if (! is_file($manifest)) {
                $this->error("No manifest.json in {$dir}. Run `pnpm capture:work` first, or pass --path or --url.");

                return self::FAILURE;
            }

            $shots = json_decode((string) file_get_contents($manifest), true)['shots'] ?? [];
        }

        $imported = 0;
        $touched = [];

        foreach ($shots as $shot) {
            $viewport = $shot['viewport'] ?? null;
            $collection = Project::CAPTURES[$viewport] ?? null;
            $project = Project::where('slug', $shot['slug'] ?? '')->first();
            $name = basename((string) ($shot['src'] ?? ''));
            $file = $dir.'/'.$name;

            if (! $collection || ! $project || ($url === '' && ! is_file($file))) {
                $this->warn("Skipped {$shot['slug']} ({$viewport}): project or file not found.");

                continue;
            }

            if ($project->getFirstMedia($collection) && ! $this->option('force')) {
                $this->line("Kept    {$project->slug} ({$viewport}): already in the dashboard.");

                continue;
            }

            if ($url !== '') {
                $download = Http::timeout(60)->get($url.'/'.$name);
                $file = tempnam(sys_get_temp_dir(), 'capture');

                if (! $download->successful() || file_put_contents($file, $download->body()) === false) {
                    @unlink($file);
                    $this->warn("Skipped {$project->slug} ({$viewport}): could not download {$name}.");

                    continue;
                }
            }

            [$width, $height] = @getimagesize($file) ?: [$shot['width'] ?? null, $shot['height'] ?? null];

            // A downloaded temp file is ours to consume; a file in the
            // frontend's folder is copied and left in place.
            $adder = $project->addMedia($file);

            if ($url === '') {
                $adder->preservingOriginal();
            }

            $adder
                ->usingName("{$project->slug}-{$viewport}")
                ->usingFileName("{$project->slug}-{$viewport}.".(pathinfo($name, PATHINFO_EXTENSION) ?: 'jpg'))
                ->withCustomProperties([
                    'alt' => "{$project->client_name} — {$viewport}",
                    'width' => $width,
                    'height' => $height,
                ])
                ->toMediaCollection($collection);

            $this->info("Imported {$project->slug} ({$viewport})");
            $imported++;
            $touched[$project->id] = $project;
        }

        // Media rows are not the project row; touching it is what tells the
        // public site to rebuild.
        foreach ($touched as $project) {
            $project->touch();
        }

        $this->info("Done: {$imported} imported.");

        return self::SUCCESS;
    }
}
