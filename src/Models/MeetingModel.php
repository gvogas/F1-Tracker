<?php

declare(strict_types=1);

namespace App\Models;

readonly class MeetingModel
{
    public function __construct(
        public int    $key,
        public string $name,
        public string $officialName,
        public string $location,
        public string $countryName,
        public string $countryCode,
        public string $circuitName,
        public string $dateStart,
        public int    $year,
    ) {}

    public static function fromArray(array $m): self
    {
        return new self(
            key:          (int)    ($m['meeting_key'] ?? 0),
            name:         (string) ($m['meeting_name'] ?? ''),
            officialName: (string) ($m['meeting_official_name'] ?? ''),
            location:     (string) ($m['location'] ?? ''),
            countryName:  (string) ($m['country_name'] ?? ''),
            countryCode:  (string) ($m['country_code'] ?? ''),
            circuitName:  (string) ($m['circuit_short_name'] ?? ''),
            dateStart:    (string) ($m['date_start'] ?? ''),
            year:         (int)    ($m['year'] ?? 0),
        );
    }

    public function toArray(): array
    {
        return [
            'key'          => $this->key,
            'name'         => $this->name,
            'officialName' => $this->officialName,
            'location'     => $this->location,
            'countryName'  => $this->countryName,
            'countryCode'  => $this->countryCode,
            'circuitName'  => $this->circuitName,
            'dateStart'    => $this->dateStart,
            'year'         => $this->year,
        ];
    }
}
