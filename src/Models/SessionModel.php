<?php

declare(strict_types=1);

namespace App\Models;

readonly class SessionModel
{
    // Ordered session type priority: higher index = higher priority
    private const TYPE_PRIORITY = [
        'Practice 1'  => 1,
        'Practice 2'  => 2,
        'Practice 3'  => 3,
        'Qualifying'  => 4,
        'Sprint'      => 5,
        'Sprint Shootout' => 5,
        'Race'        => 6,
    ];

    public function __construct(
        public int    $key,
        public string $name,
        public string $type,
        public int    $meetingKey,
        public string $dateStart,
        public string $dateEnd,
        public string $location,
        public string $countryName,
        public int    $year,
    ) {}

    public static function fromArray(array $s): self
    {
        return new self(
            key:         (int)    ($s['session_key'] ?? 0),
            name:        (string) ($s['session_name'] ?? ''),
            type:        (string) ($s['session_type'] ?? ''),
            meetingKey:  (int)    ($s['meeting_key'] ?? 0),
            dateStart:   (string) ($s['date_start'] ?? ''),
            dateEnd:     (string) ($s['date_end'] ?? ''),
            location:    (string) ($s['location'] ?? ''),
            countryName: (string) ($s['country_name'] ?? ''),
            year:        (int)    ($s['year'] ?? 0),
        );
    }

    public function priority(): int
    {
        return self::TYPE_PRIORITY[$this->name] ?? 0;
    }

    public function toArray(): array
    {
        return [
            'key'         => $this->key,
            'name'        => $this->name,
            'type'        => $this->type,
            'meetingKey'  => $this->meetingKey,
            'dateStart'   => $this->dateStart,
            'dateEnd'     => $this->dateEnd,
            'location'    => $this->location,
            'countryName' => $this->countryName,
            'year'        => $this->year,
        ];
    }
}
