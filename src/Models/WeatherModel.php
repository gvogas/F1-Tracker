<?php

declare(strict_types=1);

namespace App\Models;

readonly class WeatherModel
{
    private const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

    public function __construct(
        public float  $trackTemp,
        public float  $airTemp,
        public float  $humidity,
        public float  $rainfall,
        public float  $windSpeed,
        public int    $windDirection,
        public float  $pressure,
        public string $date,
        public int    $sessionKey,
        public int    $meetingKey,
    ) {}

    public static function fromArray(array $w): self
    {
        return new self(
            trackTemp:     (float) ($w['track_temperature'] ?? 0),
            airTemp:       (float) ($w['air_temperature'] ?? 0),
            humidity:      (float) ($w['humidity'] ?? 0),
            rainfall:      (float) ($w['rainfall'] ?? 0),
            windSpeed:     (float) ($w['wind_speed'] ?? 0),
            windDirection: (int)   ($w['wind_direction'] ?? 0),
            pressure:      (float) ($w['pressure'] ?? 0),
            date:          (string) ($w['date'] ?? ''),
            sessionKey:    (int)   ($w['session_key'] ?? 0),
            meetingKey:    (int)   ($w['meeting_key'] ?? 0),
        );
    }

    public function windCompass(): string
    {
        $idx = (int) round($this->windDirection / 22.5) % 16;
        return self::COMPASS[$idx];
    }

    public function toArray(): array
    {
        return [
            'trackTemp'      => round($this->trackTemp, 1),
            'airTemp'        => round($this->airTemp, 1),
            'humidity'       => round($this->humidity, 1),
            'rainfall'       => round($this->rainfall, 2),
            'windSpeed'      => round($this->windSpeed, 1),
            'windDirection'  => $this->windDirection,
            'windCompass'    => $this->windCompass(),
            'pressure'       => round($this->pressure, 1),
            'date'           => $this->date,
            'sessionKey'     => $this->sessionKey,
            'meetingKey'     => $this->meetingKey,
        ];
    }
}
