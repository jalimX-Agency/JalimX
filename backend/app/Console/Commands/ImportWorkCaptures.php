<?php

namespace App\Console\Commands;

use App\Models\Project;
use Illuminate\Console\Command;

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
 */
class ImportWorkCaptures extends Command
{
    protected $signature = 'projects:import-captures
        {--path= : The frontend public/work folder (defaults to ../frontend/public/work)}
        {--force : Replace captures that are already in the dashboard}';

    protected $description = 'Attach the captured live-site screenshots to their case studies';

    public function handle(): int
    {
        $dir = rtrim($this->option('path') ?: base_path('../frontend/public/work'), '/');
        $manifest = $dir.'/manifest.json';

        if (! is_file($manifest)) {
            $this->error("No manifest.json in {$dir}. Run `pnpm capture:work` first, or pass --path.");

            return self::FAILURE;
        }

        $shots = json_decode((string) file_get_contents($manifest), true)['shots'] ?? [];
        $imported = 0;
        $touched = [];

        foreach ($shots as $shot) {
            $viewport = $shot['viewport'] ?? null;
            $collection = Project::CAPTURES[$viewport] ?? null;
            $project = Project::where('slug', $shot['slug'] ?? '')->first();
            $file = $dir.'/'.basename((string) ($shot['src'] ?? ''));

            if (! $collection || ! $project || ! is_file($file)) {
                $this->warn("Skipped {$shot['slug']} ({$viewport}): project or file not found.");

                continue;
            }

            if ($project->getFirstMedia($collection) && ! $this->option('force')) {
                $this->line("Kept    {$project->slug} ({$viewport}): already in the dashboard.");

                continue;
            }

            [$width, $height] = @getimagesize($file) ?: [$shot['width'] ?? null, $shot['height'] ?? null];

            $project->addMedia($file)
                ->preservingOriginal()
                ->usingName("{$project->slug}-{$viewport}")
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
