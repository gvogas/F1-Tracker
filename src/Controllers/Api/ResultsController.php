<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ResultsController
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

        $cKey = $this->cache->key('results', ['session_key' => $sessionKey]);
        $data = $this->cache->get($cKey);

        if ($data === null) {
            [$rawDrivers, $rawResults] = $this->fetchBoth($sessionKey);

            // Build driver lookup by number
            $drivers = F1Helper::normalizeDrivers($rawDrivers);
            $byNum   = [];
            foreach ($drivers as $d) {
                $byNum[$d->number] = $d->toArray();
            }

            // Join results with driver info
            $joined = array_map(function (array $r) use ($byNum): array {
                $num    = (int) ($r['driver_number'] ?? 0);
                $driver = $byNum[$num] ?? [];

                return [
                    'position'     => (int) ($r['position'] ?? 0),
                    'driverNumber' => $num,
                    'gap'          => F1Helper::fmtGap($r['gap_to_leader'] ?? null),
                    'status'       => (string) ($r['classified_position'] ?? ''),
                    'points'       => (float) ($r['points'] ?? 0),
                    'driver'       => $driver,
                ];
            }, $rawResults);

            usort($joined, fn($a, $b) => $a['position'] <=> $b['position']);

            $data = $joined;
            $this->cache->set($cKey, $data, 3600);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }

    /** Fetch drivers and session results concurrently via two sequential curl calls. */
    private function fetchBoth(int $sessionKey): array
    {
        $drivers = $this->openF1->get('drivers', ['session_key' => $sessionKey]);
        $results = $this->openF1->get('session_result', ['session_key' => $sessionKey]);
        return [$drivers, $results];
    }
}
