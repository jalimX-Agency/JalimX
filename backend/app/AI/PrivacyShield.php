<?php

namespace App\AI;

/**
 * Takes personal data out of a request before it leaves for a provider, and
 * puts it back into the answer.
 *
 * Free tiers are paid for with data: some providers may read and keep what
 * they are sent to improve their models. A client's e-mail, phone number or
 * bank details have no business there, and the writing help does not need
 * them to write a sentence around them. Each one is swapped for a placeholder
 * such as [EMAIL_1]; the model is told to keep placeholders as they are, and
 * the real value goes back in on the way out.
 *
 * A credential can be allowed to receive personal data as it is (a paid plan
 * whose terms exclude training). Off by default.
 */
final class PrivacyShield
{
    /** Most specific first, so a bank number is not half-taken as a phone. */
    private const PATTERNS = [
        'IBAN' => '/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/',
        'CARD' => '/(?<![\d])(?:\d[ \-]?){12,18}\d(?![\d])/',
        'EMAIL' => '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i',
        // International (+212…, 00212…) and Moroccan local (06…, 07…, 05…).
        'PHONE' => '/(?<![\w+])(?:(?:\+|00)\d{1,3}[\s.\-]?\(?\d{1,4}\)?(?:[\s.\-]?\d{2,4}){2,4}|0[5-7](?:[\s.\-]?\d{2}){4})(?!\w)/',
    ];

    /** @var array<string, string> placeholder => original */
    private array $map = [];

    /** @var array<string, int> */
    private array $counters = [];

    public function mask(string $text): string
    {
        foreach (self::PATTERNS as $kind => $pattern) {
            $text = preg_replace_callback($pattern, function (array $m) use ($kind) {
                // The same value always gets the same placeholder.
                $existing = array_search($m[0], $this->map, true);
                if ($existing !== false) {
                    return $existing;
                }

                $this->counters[$kind] = ($this->counters[$kind] ?? 0) + 1;
                $placeholder = "[{$kind}_{$this->counters[$kind]}]";
                $this->map[$placeholder] = $m[0];

                return $placeholder;
            }, $text) ?? $text;
        }

        return $text;
    }

    public function unmask(string $text): string
    {
        return $this->map === [] ? $text : strtr($text, $this->map);
    }

    public function masked(): int
    {
        return count($this->map);
    }

    /** The request as it may leave: personal data swapped for placeholders. */
    public function protect(AiRequest $request): AiRequest
    {
        $prompt = $this->mask($request->prompt);

        if ($this->map === []) {
            return $request;
        }

        return new AiRequest(
            system: $request->system."\nSome values were replaced by placeholders such as [EMAIL_1] or [PHONE_1]. Keep any placeholder you use exactly as written; never invent the value behind it.",
            prompt: $prompt,
            maxTokens: $request->maxTokens,
            temperature: $request->temperature,
            json: $request->json,
        );
    }
}
