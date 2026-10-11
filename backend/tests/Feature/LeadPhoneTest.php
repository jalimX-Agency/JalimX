<?php

namespace Tests\Feature;

use App\Models\Lead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The contact form takes a phone number from anywhere in the world. */
class LeadPhoneTest extends TestCase
{
    use RefreshDatabase;

    private function enquire(string $phone)
    {
        return $this->postJson('/api/v1/leads', [
            'name' => 'Test Person',
            'email' => 'test@example.test',
            'phone' => $phone,
            'message' => 'A message that is long enough to pass.',
        ]);
    }

    /** @return array<string, array{string}> */
    public static function numbers(): array
    {
        return [
            'morocco local' => ['0612345678'],
            'morocco international' => ['+212 612-345678'],
            'france' => ['+33 6 12 34 56 78'],
            'usa with brackets' => ['+1 (415) 555-0132'],
            'uk with dots' => ['+44.20.7946.0958'],
            'germany' => ['+49 151 23456789'],
            'double zero prefix' => ['00971 50 123 4567'],
        ];
    }

    /** @dataProvider numbers */
    public function test_a_number_from_anywhere_is_accepted(string $phone): void
    {
        $this->enquire($phone)->assertCreated();
    }

    public function test_arabic_indic_digits_are_stored_as_ordinary_ones(): void
    {
        $this->enquire('+٢١٢ ٦١٢٣٤٥٦٧٨')->assertCreated();

        $this->assertSame('+212 612345678', Lead::first()->phone);
    }

    public function test_things_that_are_not_numbers_are_refused(): void
    {
        foreach (['abcdefgh', '12345', '+1234567890123456', '0612 345 678 ext 5', 'call me'] as $bad) {
            $this->enquire($bad)->assertUnprocessable()->assertJsonValidationErrors('phone');
        }
    }
}
