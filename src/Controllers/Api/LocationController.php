<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class LocationController extends ApiController
{
    /**
     * Car positions in a small recent window so we never pull a whole session.
     * Live (no `date`) → last ~4s up to now. Replay (`date`) → ~4s up to that point.
     */
    public function index(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $sessionKey = (int) ($params['session_key'] ?? 0);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $date = $params['date'] ?? null;
        // Live key is window-less so rapid polls/viewers share; replay keys by timestamp.
        $cKey = $this->cache->key('location', array_filter([
            'session_key' => $sessionKey,
            'date'        => $date,
        ]));

        return $this->cachedJson($response, $cKey, 3, fn(): array => $this->fetchWindow($sessionKey, $date));
    }

    /** @return array<mixed> */
    private function fetchWindow(int $sessionKey, ?string $date): array
    {
        $anchor = ($date && ($t = strtotime($date)) !== false) ? $t : time();
        $from   = gmdate('Y-m-d\TH:i:s', $anchor - 4) . 'Z';
        $params = ['session_key' => $sessionKey, 'date' => '>=' . $from];
        if ($date) {
            $params['date'] = ['>=' . $from, '<=' . $date];
        }

        try {
            return $this->openF1->get('location', $params);
        } catch (Throwable $e) {
            return [];
        }
    }

    /**
     * One driver's path, downsampled into an ordered outline of the circuit.
     * Live (no `date`) → last ~3 min up to now. Replay (`date`) → ~3 min centred
     * on that point, so a finished session still yields a lap-shaped outline.
     */
    public function outline(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $sessionKey = (int) ($params['session_key'] ?? 0);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $date = $params['date'] ?? null;
        $cKey = $this->cache->key('track-outline', array_filter([
            'session_key' => $sessionKey,
            'date'        => $date,
        ]));

        return $this->cachedJson($response, $cKey, 3600, fn(): array => $this->buildOutline($sessionKey, $date));
    }

    /** @return array<int, array{x: float, y: float}> */
    private function buildOutline(int $sessionKey, ?string $date): array
    {
        $driverNum = $this->pickDriverNumber($sessionKey);
        if ($driverNum === 0) {
            return [];
        }

        $base = ['session_key' => $sessionKey, 'driver_number' => $driverNum];
        if ($date && ($t = strtotime($date)) !== false) {
            $base['date'] = ['>=' . gmdate('Y-m-d\TH:i:s', $t - 90) . 'Z',
                             '<=' . gmdate('Y-m-d\TH:i:s', $t + 90) . 'Z'];
        } else {
            $base['date'] = '>=' . gmdate('Y-m-d\TH:i:s', time() - 180) . 'Z';
        }

        try {
            $rows = $this->openF1->get('location', $base);
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
