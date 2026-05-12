<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class TowerController
{
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

        $posParams  = ['session_key' => $sessionKey];
        $carParams  = ['session_key' => $sessionKey];

        if ($date) {
            $posParams['date'] = '<=' . $date;
            // Last 2 seconds for car data to keep payload small
            $fromDate          = date('Y-m-d\TH:i:s', strtotime($date) - 2) . 'Z';
            $carParams['date'] = '>=' . $fromDate;
        }

        // Fetch all required streams — stints/pits are slow-changing, use longer cache
        $stintKey    = $this->cache->key('stints',   ['session_key' => $sessionKey]);
        $pitKey      = $this->cache->key('pits',     ['session_key' => $sessionKey]);
        $driverKey   = $this->cache->key('drivers',  ['session_key' => $sessionKey]);

        $stints  = $this->cache->get($stintKey)  ?? $this->fetchAndCache('stints',   ['session_key' => $sessionKey], $stintKey,  60);
        $pits    = $this->cache->get($pitKey)     ?? $this->fetchAndCache('pit',      ['session_key' => $sessionKey], $pitKey,    60);
        $rawDrv  = $this->cache->get($driverKey)  ?? $this->fetchAndCache('drivers',  ['session_key' => $sessionKey], $driverKey, 3600);

        $positions = $this->openF1->get('position',  $posParams);
        $intervals = $this->openF1->get('intervals', $posParams);
        $laps      = $this->openF1->get('laps',      $posParams);
        $carData   = $this->openF1->get('car_data',  $carParams);

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

        $this->cache->set($cKey, $rows, 5);

        $response->getBody()->write(json_encode($rows, JSON_UNESCAPED_UNICODE));
        return $response;
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

    private function fetchAndCache(string $endpoint, array $params, string $cKey, int $ttl): array
    {
        $data = $this->openF1->get($endpoint, $params);
        $this->cache->set($cKey, $data, $ttl);
        return $data;
    }
}
