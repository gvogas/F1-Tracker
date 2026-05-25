<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class TowerController
{
    /** Assembled-tower output cache, matched to the ~5s frontend poll. */
    private const OUTPUT_TTL = 5;
    /** Raw live streams — slightly longer than the poll so rebuilds reuse warm data. */
    private const STREAM_TTL = 10;

    public function __construct(
        private readonly OpenF1Service $openF1,
        private readonly CacheService  $cache,
    ) {}

    public function index(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $sessionKey = (int) ($params['session_key'] ?? 0);

        if ($sessionKey === 0) {
            $response->getBody()->write(json_encode(['error' => 'session_key is required']));
            return $response->withStatus(400);
        }

        $date   = $params['date'] ?? null;
        $cKey   = $this->cache->key('tower', array_filter([
            'session_key' => $sessionKey,
            'date'        => $date,
        ]));
        $cached = $this->cache->get($cKey);

        if ($cached !== null) {
            $response->getBody()->write(json_encode($cached, JSON_UNESCAPED_UNICODE));
            return $response;
        }

        $rows    = $this->buildRows($sessionKey, $date);
        $lastKey = $this->cache->key('tower_last', ['session_key' => $sessionKey]);

        // Graceful degradation: an upstream hiccup can leave us with no rows.
        // Serve the last good snapshot instead of blanking the tower.
        if (empty($rows)) {
            $last = $this->cache->get($lastKey);
            if (!empty($last)) {
                $response->getBody()->write(json_encode($last, JSON_UNESCAPED_UNICODE));
                return $response;
            }
        } else {
            $this->cache->set($lastKey, $rows, 120);
        }

        $this->cache->set($cKey, $rows, self::OUTPUT_TTL);

        $response->getBody()->write(json_encode($rows, JSON_UNESCAPED_UNICODE));
        return $response;
    }

    /** @return array<int, array<string, mixed>> */
    private function buildRows(int $sessionKey, ?string $date): array
    {
        $posParams = ['session_key' => $sessionKey];

        if ($date) {
            $posParams['date'] = '<=' . $date;
        }

        // Position/intervals/laps are cached and shared with AiController.
        // Slow-changing streams (stints/pits/drivers) use longer TTLs.
        $positions = $this->stream('position',  $posParams, self::STREAM_TTL);
        $intervals = $this->stream('intervals', $posParams, self::STREAM_TTL);
        $laps      = $this->stream('laps',      $posParams, self::STREAM_TTL);
        $stints    = $this->stream('stints',    ['session_key' => $sessionKey], 60);
        $pits      = $this->stream('pit',       ['session_key' => $sessionKey], 60);
        $rawDrv    = $this->stream('drivers',   ['session_key' => $sessionKey], 3600);
        $carData   = $this->fetchCarData($sessionKey, $date);

        if (empty($positions)) {
            return [];
        }

        // Normalise drivers for lookup
        $drivers = F1Helper::normalizeDrivers($rawDrv);
        $drvMap  = [];
        foreach ($drivers as $d) {
            $drvMap[$d->number] = $d->toArray();
        }

        // Collapse each stream to latest entry per driver
        $latestPos = $this->latestByDriver($positions, 'driver_number');
        $latestInt = $this->latestByDriver($intervals, 'driver_number');
        $latestLap = $this->latestByDriver($laps,      'driver_number');
        $latestCar = $this->latestByDriver($carData,   'driver_number');

        // Build per-driver stints (all, not just latest)
        $stintsByDriver = [];
        foreach ($stints as $stint) {
            $num = (int) ($stint['driver_number'] ?? 0);
            $stintsByDriver[$num][] = $stint;
        }

        $pitsByDriver = [];
        foreach ($pits as $pit) {
            $num = (int) ($pit['driver_number'] ?? 0);
            $pitsByDriver[$num][] = $pit;
        }

        // Assemble rows
        $rows = [];
        foreach ($latestPos as $num => $pos) {
            $intData  = $latestInt[$num]  ?? [];
            $lapData  = $latestLap[$num]  ?? [];
            $carEntry = $latestCar[$num]  ?? [];
            $drvStints = $stintsByDriver[$num] ?? [];
            $drvPits  = $pitsByDriver[$num]    ?? [];
            $drvInfo  = $drvMap[$num]          ?? [];

            $latestStint = end($drvStints) ?: [];
            $compound    = F1Helper::normalizeCompound((string) ($latestStint['compound'] ?? ''));

            $rows[] = [
                'driverNumber' => $num,
                'position'     => (int) ($pos['position'] ?? 0),
                'driver'       => $drvInfo,
                'gap'          => F1Helper::fmtGap($intData['gap_to_leader'] ?? null),
                'interval'     => F1Helper::fmtGap($intData['interval'] ?? null),
                'lapNumber'    => (int) ($lapData['lap_number'] ?? 0),
                'lastLap'      => F1Helper::fmtLapTime((float) ($lapData['lap_duration'] ?? 0)),
                'sector1'      => (float) ($lapData['duration_sector_1'] ?? 0),
                'sector2'      => (float) ($lapData['duration_sector_2'] ?? 0),
                'sector3'      => (float) ($lapData['duration_sector_3'] ?? 0),
                'compound'     => $compound,
                'tyreAge'      => (int) ($latestStint['tyre_age_at_start'] ?? 0),
                'pitCount'     => count($drvPits),
                'drs'          => (int) ($carEntry['drs'] ?? 0),
                'speed'        => (int) ($carEntry['speed'] ?? 0),
            ];
        }

        usort($rows, fn($a, $b) => $a['position'] <=> $b['position']);

        return $rows;
    }

    /** Collapse array to latest entry per driver using date field. */
    private function latestByDriver(array $items, string $numField = 'driver_number'): array
    {
        $latest = [];
        foreach ($items as $item) {
            $num  = (int) ($item[$numField] ?? 0);
            $date = (string) ($item['date'] ?? '');
            if (!isset($latest[$num]) || $date > (string) ($latest[$num]['date'] ?? '')) {
                $latest[$num] = $item;
            }
        }
        return $latest;
    }

    /**
     * Cache-backed stream fetch. Reuses the warm cache (shared with AiController)
     * and degrades to the last cached value (or empty) instead of throwing.
     *
     * @return array<mixed>
     */
    private function stream(string $endpoint, array $params, int $ttl): array
    {
        $key = $this->cache->key($endpoint, $params);
        try {
            return $this->cache->remember($key, $ttl, fn() => $this->openF1->get($endpoint, $params));
        } catch (Throwable $e) {
            return $this->cache->get($key) ?? [];
        }
    }

    /**
     * Telemetry is huge — only ever pull a recent window so we never fetch a
     * whole session's car_data. Failures degrade to empty (drs/speed are optional).
     *
     * @return array<mixed>
     */
    private function fetchCarData(int $sessionKey, ?string $date): array
    {
        $anchor = ($date && ($t = strtotime($date)) !== false) ? $t : time();
        $from   = gmdate('Y-m-d\TH:i:s', $anchor - 5) . 'Z';
        $params = ['session_key' => $sessionKey, 'date' => '>=' . $from];
        if ($date) {
            $params['date'] = ['>=' . $from, '<=' . $date];
        }

        try {
            return $this->openF1->get('car_data', $params);
        } catch (Throwable $e) {
            return [];
        }
    }
}
