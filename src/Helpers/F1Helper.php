<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Models\DriverModel;
use App\Models\MeetingModel;
use App\Models\SessionModel;
use App\Models\WeatherModel;

class F1Helper
{
    // ─── Drivers ─────────────────────────────────────────────────────────────

    /**
     * Normalise + deduplicate a raw driver list.
     * Keeps the last entry per driver number (latest data wins).
     *
     * @param  array<array<mixed>> $raw
     * @return DriverModel[]
     */
    public static function normalizeDrivers(array $raw): array
    {
        $byNumber = [];
        foreach ($raw as $d) {
            $num = (int) ($d['driver_number'] ?? 0);
            if ($num > 0) {
                $byNumber[$num] = DriverModel::fromArray($d);
            }
        }

        $drivers = array_values($byNumber);
        usort($drivers, fn(DriverModel $a, DriverModel $b) => $a->number <=> $b->number);

        return $drivers;
    }

    /** @return string[] Unique sorted team names */
    public static function teamsFromDrivers(array $drivers): array
    {
        $teams = array_unique(array_map(fn(DriverModel $d) => $d->teamName, $drivers));
        sort($teams);
        return array_values($teams);
    }

    // ─── Meetings ─────────────────────────────────────────────────────────────

    /**
     * @param  array<array<mixed>> $raw
     * @return MeetingModel[]
     */
    public static function normalizeMeetings(array $raw): array
    {
        $meetings = array_map(fn(array $m) => MeetingModel::fromArray($m), $raw);

        usort($meetings, fn(MeetingModel $a, MeetingModel $b) =>
            strcmp($a->dateStart, $b->dateStart)
        );

        return $meetings;
    }

    /** Return the latest meeting that has already started. */
    public static function latestStartedMeeting(array $meetings): ?MeetingModel
    {
        $now     = time();
        $started = array_filter($meetings, fn(MeetingModel $m) =>
            $m->dateStart !== '' && strtotime($m->dateStart) <= $now
        );

        if (!$started) {
            return null;
        }

        return end($started) ?: null;
    }

    // ─── Sessions ─────────────────────────────────────────────────────────────

    /**
     * @param  array<array<mixed>> $raw
     * @return SessionModel[]
     */
    public static function normalizeSessions(array $raw): array
    {
        $sessions = array_map(fn(array $s) => SessionModel::fromArray($s), $raw);

        usort($sessions, fn(SessionModel $a, SessionModel $b) =>
            strcmp($a->dateStart, $b->dateStart)
        );

        return $sessions;
    }

    /**
     * Pick best session: Race > Sprint > Qualifying > latest.
     *
     * @param SessionModel[] $sessions
     */
    public static function pickBestSession(array $sessions): ?SessionModel
    {
        if (!$sessions) {
            return null;
        }

        $best = null;
        foreach ($sessions as $s) {
            if ($best === null || $s->priority() > $best->priority()) {
                $best = $s;
            }
        }

        return $best;
    }

    // ─── Weather ──────────────────────────────────────────────────────────────

    /**
     * @param  array<array<mixed>> $raw
     * @return WeatherModel|null   Latest entry, or null if list is empty
     */
    public static function latestWeather(array $raw): ?WeatherModel
    {
        if (!$raw) {
            return null;
        }

        // Sort ascending and take last
        usort($raw, fn($a, $b) => strcmp((string)($a['date'] ?? ''), (string)($b['date'] ?? '')));
        return WeatherModel::fromArray(end($raw));
    }

    // ─── Formatting helpers ───────────────────────────────────────────────────

    /** Format gap/interval value for timing tower display. */
    public static function fmtGap(mixed $value): string
    {
        if ($value === null || $value === '' || $value === 'LAP') {
            return (string) ($value ?? '—');
        }

        $f = (float) $value;
        if ($f === 0.0) {
            return 'Leader';
        }

        return '+' . number_format(abs($f), 3);
    }

    /** Format lap time in seconds to M:SS.mmm */
    public static function fmtLapTime(?float $seconds): string
    {
        if ($seconds === null || $seconds <= 0) {
            return '—';
        }

        $m  = (int) ($seconds / 60);
        $s  = $seconds - $m * 60;
        return sprintf('%d:%06.3f', $m, $s);
    }

    /** Tyre compound short label. */
    public static function normalizeCompound(string $raw): string
    {
        return match (strtoupper($raw)) {
            'SOFT'         => 'S',
            'MEDIUM'       => 'M',
            'HARD'         => 'H',
            'INTERMEDIATE' => 'I',
            'WET'          => 'W',
            default        => strtoupper(substr($raw, 0, 1)) ?: '?',
        };
    }
}
