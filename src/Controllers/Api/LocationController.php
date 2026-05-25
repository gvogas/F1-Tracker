<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class LocationController extends ApiController
{
    /** Live car positions: only a recent window so we never pull a whole session. */
    public function index(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        // Stable (window-less) key so rapid polls and multiple viewers share the cache.
        $cKey = $this->cache->key('location', ['session_key' => $sessionKey]);

        return $this->cachedJson($response, $cKey, 3, function () use ($sessionKey): array {
            $from = gmdate('Y-m-d\TH:i:s', time() - 4) . 'Z';
            try {
                return $this->openF1->get('location', [
                    'session_key' => $sessionKey,
                    'date'        => '>=' . $from,
                ]);
            } catch (Throwable $e) {
                return [];
            }
        });
    }

    /** One driver's recent path, downsampled into an ordered outline of the circuit. */
    public function outline(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $cKey = $this->cache->key('track-outline', ['session_key' => $sessionKey]);

        return $this->cachedJson($response, $cKey, 3600, fn(): array => $this->buildOutline($sessionKey));
    }

    /** @return array<int, array{x: float, y: float}> */
    private function buildOutline(int $sessionKey): array
    {
        $driverNum = $this->pickDriverNumber($sessionKey);
        if ($driverNum === 0) {
            return [];
        }

        $from = gmdate('Y-m-d\TH:i:s', time() - 120) . 'Z'; // ~one lap
        try {
            $rows = $this->openF1->get('location', [
                'session_key'   => $sessionKey,
                'driver_number' => $driverNum,
                'date'          => '>=' . $from,
            ]);
        } catch (Throwable $e) {
            return [];
        }

        // Order by time, then downsample to a manageable number of points.
        usort($rows, fn($a, $b) => strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? '')));

        $step   = max(1, (int) floor(count($rows) / 150));
        $points = [];
        for ($i = 0; $i < count($rows); $i += $step) {
            $x = $rows[$i]['x'] ?? null;
            $y = $rows[$i]['y'] ?? null;
            if (is_numeric($x) && is_numeric($y) && ((float) $x !== 0.0 || (float) $y !== 0.0)) {
                $points[] = ['x' => (float) $x, 'y' => (float) $y];
            }
        }

        return $points;
    }

    /** First available driver number from the shared (raw) drivers cache. */
    private function pickDriverNumber(int $sessionKey): int
    {
        try {
            $drivers = $this->fetchCached('drivers', ['session_key' => $sessionKey], 3600);
        } catch (Throwable $e) {
            return 0;
        }

        foreach ($drivers as $d) {
            $num = (int) ($d['driver_number'] ?? 0);
            if ($num > 0) {
                return $num;
            }
        }
        return 0;
    }
}
