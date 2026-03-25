<?php

declare(strict_types=1);

namespace App\Models;

readonly class DriverModel
{
    public function __construct(
        public int    $number,
        public string $fullName,
        public string $firstName,
        public string $lastName,
        public string $acronym,
        public string $broadcastName,
        public string $teamName,
        public string $teamColour,
        public string $headshotUrl,
        public string $countryCode,
        public int    $sessionKey,
        public int    $meetingKey,
    ) {}

    public static function fromArray(array $d): self
    {
        $firstName = (string) ($d['first_name'] ?? '');
        $lastName  = (string) ($d['last_name'] ?? '');

        return new self(
            number:        (int)    ($d['driver_number'] ?? 0),
            fullName:      trim($firstName . ' ' . $lastName) ?: (string) ($d['full_name'] ?? ''),
            firstName:     $firstName,
            lastName:      $lastName,
            acronym:       strtoupper((string) ($d['name_acronym'] ?? '')),
            broadcastName: (string) ($d['broadcast_name'] ?? ''),
            teamName:      (string) ($d['team_name'] ?? ''),
            teamColour:    ltrim((string) ($d['team_colour'] ?? '000000'), '#'),
            headshotUrl:   (string) ($d['headshot_url'] ?? ''),
            countryCode:   (string) ($d['country_code'] ?? ''),
            sessionKey:    (int)    ($d['session_key'] ?? 0),
            meetingKey:    (int)    ($d['meeting_key'] ?? 0),
        );
    }

    public function toArray(): array
    {
        return [
            'number'        => $this->number,
            'fullName'      => $this->fullName,
            'firstName'     => $this->firstName,
            'lastName'      => $this->lastName,
            'acronym'       => $this->acronym,
            'broadcastName' => $this->broadcastName,
            'teamName'      => $this->teamName,
            'teamColour'    => $this->teamColour,
            'headshotUrl'   => $this->headshotUrl,
            'countryCode'   => $this->countryCode,
            'sessionKey'    => $this->sessionKey,
            'meetingKey'    => $this->meetingKey,
        ];
    }
}
