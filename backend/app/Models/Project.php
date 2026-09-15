<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\Translatable\HasTranslations;

class Project extends Model implements HasMedia
{
    use HasTranslations;
    use InteractsWithMedia;

    public array $translatable = ['title', 'summary', 'challenge', 'solution', 'outcome'];

    protected $fillable = [
        'slug', 'position', 'is_published', 'is_featured',
        'client_name', 'year', 'project_url',
        'title', 'summary', 'challenge', 'solution', 'outcome',
        'tags', 'stack', 'metrics', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'is_featured' => 'boolean',
            'position' => 'integer',
            'year' => 'integer',
            'tags' => 'array',
            'stack' => 'array',
            'metrics' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function testimonials(): HasMany
    {
        return $this->hasMany(Testimonial::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('is_published', true);
    }

    public function scopeFeatured(Builder $query): Builder
    {
        return $query->where('is_featured', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position')->orderByDesc('year')->orderBy('id');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('cover')->singleFile();
        $this->addMediaCollection('gallery');

        /*
         * Screenshots of the client's own admin, for the case study. Public,
         * so the dashboard warns at upload time: nothing with a customer's
         * name, email or booking in it belongs in this collection.
         */
        $this->addMediaCollection('dashboard');
    }
}
