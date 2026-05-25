<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ResultsController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $cKey = $this->cache->key('results', ['session_key' => $sessionKey]);

        return $this->cachedJson($response, $cKey, 3600, fn(): array => $this->buildResults($sessionKey));
    }

    /** @return array<int, array<string, mixed>> */
    private function buildResults(int $sessionKey): array
    {
        $rawDrivers = $this->openF1->get('drivers',        ['session_key' => $sessionKey]);
        $rawResults = $this->openF1->get('session_result', ['session_key' => $sessionKey]);

        // Build driver lookup by number
        $drivers = F1Helper::normalizeDrivers($rawDrivers);
        $byNum   = [];
        foreach ($drivers as $d) {
            $byNum[$d->number] = $d->toArray();
        }

        // Join results with driver info
        $joined = array_map(function (array $r) use ($byNum): array {
            $num = (int) ($r['driver_number'] ?? 0);

            return [
                'position'     => (int) ($r['position'] ?? 0),
                'driverNumber' => $num,
                'gap'          => F1Helper::fmtGap($r['gap_to_leader'] ?? null),
                'status'       => (string) ($r['classified_position'] ?? ''),
                'points'       => (float) ($r['points'] ?? 0),
                'driver'       => $byNum[$num] ?? [],
            ];
        }, $rawResults);

        usort($joined, fn($a, $b) => $a['position'] <=> $b['position']);

        return $joined;
    }
}
