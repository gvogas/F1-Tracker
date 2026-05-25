<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class TowerController extends ApiController
{
    /** Assembled-tower output cache, matched to the ~5s frontend poll. */
    private const OUTPUT_TTL = 5;
    /** Raw live streams — slightly longer than the poll so rebuilds reuse warm data. */
    private const STREAM_TTL = 10;

    public function index(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $sessionKey = (int) ($params['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $date   = $params['date'] ?? null;
        $cKey   = $this->cache->key('tower', array_filter([
            'session_key' => $sessionKey,
            'date'        => $date,
        ]));
        $cached = $this->cache->get($cKey);

        if ($cached !== null) {
            return $this->json($response, $cached);
        }

        $rows    = $this->buildRows($sessionKey, $date);
        $lastKey = $this->cache->key('tower_last', ['session_key' => $sessionKey]);

        // Graceful degradation: an upstream hiccup can leave us with no rows.
        // Serve the last good snapshot instead of blanking the tower.
        if (empty($rows)) {
            $last = $this->cache->get($lastKey);
            if (!empty($last)) {
                return $this->json($response, $last);
            }
        } else {
            $this->cache->set($lastKey, $rows, 120);
        }

        $this->cache->set($cKey, $rows, self::OUTPUT_TTL);

        return $this->json($response, $rows);
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
        // fetchCachedSafe degrades to the last cached value so one bad stream
        // doesn't blank the whole board.
        $positions = $this->fetchCachedSafe('position',  $posParams, self::STREAM_TTL);
        $intervals = $this->fetchCachedSafe('intervals', $posParams, self::STREAM_TTL);
        $laps      = $this->fetchCachedSafe('laps',      $posParams, self::STREAM_TTL);
        $stints    = $this->fetchCachedSafe('stints',    ['session_key' => $sessionKey], 60);
        $pits      = $this->fetchCachedSafe('pit',       ['session_key' => $sessionKey], 60);
        $rawDrv    = $this->fetchCachedSafe('drivers',   ['session_key' => $sessionKey], 3600);
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
        $latestPos = F1Helper::latestByDriver($positions);
        $latestInt = F1Helper::latestByDriver($intervals);
        $latestLap = F1Helper::latestByDriver($laps);
        $latestCar = F1Helper::latestByDriver($carData);

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
            // Normalise both bounds the same way (UTC) rather than echoing the raw input.
            $to = gmdate('Y-m-d\TH:i:s', $anchor) . 'Z';
            $params['date'] = ['>=' . $from, '<=' . $to];
        }

        try {
            return $this->openF1->get('car_data', $params);
        } catch (Throwable $e) {
            return [];
        }
    }
}
