<?php

namespace App\Http\Resources\Concerns;

/**
 * Shapes loose model data into payloads whose type can actually be read.
 *
 * `getTranslations()` and array-cast columns hand back untyped arrays, which
 * the OpenAPI generator can only describe as `unknown` - and `unknown` on the
 * frontend is barely better than no contract at all. Everything here is built
 * as a literal with explicit casts, so the shape *and* the leaf types are
 * inferable from the code rather than from a docblock that can drift out of
 * sync with it.
 *
 * It also normalises: every locale key is always present, so the frontend never
 * has to guard against a missing translation.
 */
trait SerialisesContent
{
    /** A translatable field as a complete {en, fr} pair of strings. */
    protected function tr(string $field): array
    {
        $stored = $this->resource->getTranslations($field);

        return [
            'en' => (string) ($stored['en'] ?? ''),
            'fr' => (string) ($stored['fr'] ?? ''),
        ];
    }

    /** A JSON array column as a clean list of strings. */
    protected function strings(?array $values): array
    {
        $out = [];

        foreach ($values ?? [] as $value) {
            $string = (string) $value;

            if ($string !== '') {
                $out[] = $string;
            }
        }

        return $out;
    }

    /** Case-study metrics: a label per locale plus the figure itself. */
    protected function metricList(?array $metrics): array
    {
        $out = [];

        foreach ($metrics ?? [] as $metric) {
            $out[] = [
                'label' => [
                    'en' => (string) ($metric['label']['en'] ?? ''),
                    'fr' => (string) ($metric['label']['fr'] ?? ''),
                ],
                'value' => (string) ($metric['value'] ?? ''),
            ];
        }

        return $out;
    }
}
