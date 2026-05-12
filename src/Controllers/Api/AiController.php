<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\HuggingFaceService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class AiController
{
    private const MISTRAL  = 'mistralai/Mistral-7B-Instruct-v0.3';
    private const BART     = 'facebook/bart-large-cnn';
    private const FLAN_T5  = 'google/flan-t5-base';

    public function __construct(
        private readonly OpenF1Service      $openF1,
        private readonly CacheService       $cache,
        private readonly HuggingFaceService $hf,
    ) {}

    // ─── Goal 6: AI Race Commentator ─────────────────────────────────────────

    public function commentator(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        try {
            $tower   = $this->getTowerSnapshot($sessionKey);
            $rcMsgs  = $this->openF1->get('race_control', ['session_key' => $sessionKey]);
            $lastMsg = end($rcMsgs);
            $rcText  = $lastMsg ? ($lastMsg['message'] ?? '') : 'No race control messages.';

            $prompt = "You are an enthusiastic Formula 1 TV commentator. Based on the following live timing data, "
                . "provide 2-4 sentences of exciting live race commentary. Use driver surnames and team names. "
                . "Be dramatic but accurate.\n\nCurrent timing tower:\n"
                . $this->towerToText($tower)
                . "\n\nLatest race control: {$rcText}\n\nCommentary:";

            $commentary = $this->hf->generate(self::MISTRAL, $prompt, 200);
            return $this->json($response, ['commentary' => $commentary]);
        } catch (Throwable $e) {
            return $this->error($response, $e->getMessage(), 502);
        }
    }

    // ─── Goal 7: Tyre Strategy Analyser ──────────────────────────────────────

    public function tyreStrategy(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        try {
            $stints  = $this->openF1->get('stints', ['session_key' => $sessionKey]);
            $pits    = $this->openF1->get('pit',    ['session_key' => $sessionKey]);
            $rawDrv  = $this->cachedDrivers($sessionKey);
            $drivers = F1Helper::normalizeDrivers($rawDrv);
            $drvMap  = [];
            foreach ($drivers as $d) {
                $drvMap[$d->number] = $d->acronym;
            }

            $stratText = $this->stintsToText($stints, $pits, $drvMap);
            $prompt    = "You are an F1 strategy analyst. Analyse the following tyre stint and pit stop data and explain "
                . "which driver used the best strategy and which lost the most time. Be concise (2-3 sentences).\n\n"
                . "Stint data:\n{$stratText}\n\nStrategy analysis:";

            $analysis = $this->hf->generate(self::MISTRAL, $prompt, 250);
            return $this->json($response, ['analysis' => $analysis]);
        } catch (Throwable $e) {
            return $this->error($response, $e->getMessage(), 502);
        }
    }

    // ─── Goal 8: Race Control Explainer ──────────────────────────────────────

    public function raceControlExplain(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        try {
            $messages = $this->openF1->get('race_control', ['session_key' => $sessionKey]);

            if (empty($messages)) {
                return $this->json($response, ['explanation' => 'No race control messages yet.']);
            }

            $text = implode('. ', array_map(
                fn($m) => ($m['message'] ?? '') . ' (lap ' . ($m['lap_number'] ?? '?') . ')',
                $messages
            ));

            $explanation = $this->hf->summarise(self::BART, $text, 150);
            return $this->json($response, ['explanation' => $explanation]);
        } catch (Throwable $e) {
            return $this->error($response, $e->getMessage(), 502);
        }
    }

    // ─── Goal 9: Performance Analysis & Race Prediction ──────────────────────

    public function performance(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        try {
            $tower   = $this->getTowerSnapshot($sessionKey);
            $rawDrv  = $this->cachedDrivers($sessionKey);
            $drivers = F1Helper::normalizeDrivers($rawDrv);
            $drvMap  = [];
            foreach ($drivers as $d) {
                $drvMap[$d->number] = $d->acronym;
            }

            $paceLines = array_map(function (array $row) use ($drvMap): string {
                $acronym = $drvMap[$row['driverNumber']] ?? "#{$row['driverNumber']}";
                return sprintf(
                    'P%d %s: gap=%s, last lap=%s, tyre=%s (age %d), pits=%d',
                    $row['position'], $acronym,
                    $row['gap'], $row['lastLap'],
                    $row['compound'], $row['tyreAge'], $row['pitCount'],
                );
            }, $tower);

            $input  = "Given this F1 race data, predict the likely final finishing order and explain the key factors: "
                . implode('; ', $paceLines);

            $result = $this->hf->text2text(self::FLAN_T5, $input);
            return $this->json($response, [
                'prediction' => $result,
                'analysis'   => 'Based on current pace, gap trends, and tyre strategy.',
            ]);
        } catch (Throwable $e) {
            return $this->error($response, $e->getMessage(), 502);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function parseSessionKey(Request $request): int
    {
        $body = (array) ($request->getParsedBody() ?? []);
        if (empty($body)) {
            $body = (array) (json_decode((string) $request->getBody(), true) ?? []);
        }
        return (int) ($body['session_key'] ?? 0);
    }

    private function json(Response $response, mixed $data): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }

    private function error(Response $response, string $message, int $status): Response
    {
        $response->getBody()->write(json_encode(['error' => $message], JSON_UNESCAPED_UNICODE));
        return $response->withStatus($status);
    }

    private function getTowerSnapshot(int $sessionKey): array
    {
        // Fetch position + intervals for a quick snapshot (no full tower build needed here)
        $positions = $this->openF1->get('position',  ['session_key' => $sessionKey]);
        $intervals = $this->openF1->get('intervals', ['session_key' => $sessionKey]);
        $laps      = $this->openF1->get('laps',      ['session_key' => $sessionKey]);
        $stints    = $this->cachedStints($sessionKey);
        $pits      = $this->cachedPits($sessionKey);
        $rawDrv    = $this->cachedDrivers($sessionKey);

        $drivers = F1Helper::normalizeDrivers($rawDrv);
        $drvMap  = [];
        foreach ($drivers as $d) {
            $drvMap[$d->number] = $d->toArray();
        }

        $latestPos = $this->latestByDriver($positions);
        $latestInt = $this->latestByDriver($intervals);
        $latestLap = $this->latestByDriver($laps);

        $stintsByDriver = [];
        foreach ($stints as $s) {
            $stintsByDriver[(int)($s['driver_number'] ?? 0)][] = $s;
        }
        $pitsByDriver = [];
        foreach ($pits as $p) {
            $pitsByDriver[(int)($p['driver_number'] ?? 0)][] = $p;
        }

        $rows = [];
        foreach ($latestPos as $num => $pos) {
            $intData = $latestInt[$num] ?? [];
            $lapData = $latestLap[$num] ?? [];
            $drvStints = $stintsByDriver[$num] ?? [];
            $lastStint = end($drvStints) ?: [];

            $rows[] = [
                'driverNumber' => $num,
                'position'     => (int)   ($pos['position'] ?? 0),
                'driver'       => $drvMap[$num] ?? [],
                'gap'          => F1Helper::fmtGap($intData['gap_to_leader'] ?? null),
                'interval'     => F1Helper::fmtGap($intData['interval'] ?? null),
                'lastLap'      => F1Helper::fmtLapTime((float) ($lapData['lap_duration'] ?? 0)),
                'compound'     => F1Helper::normalizeCompound((string) ($lastStint['compound'] ?? '')),
                'tyreAge'      => (int) ($lastStint['tyre_age_at_start'] ?? 0),
                'pitCount'     => count($pitsByDriver[$num] ?? []),
            ];
        }

        usort($rows, fn($a, $b) => $a['position'] <=> $b['position']);
        return $rows;
    }

    private function towerToText(array $rows): string
    {
        return implode("\n", array_map(function (array $r): string {
            $name = $r['driver']['acronym'] ?? "#{$r['driverNumber']}";
            return "P{$r['position']} {$name}: gap={$r['gap']}, tyre={$r['compound']}, last={$r['lastLap']}";
        }, $rows));
    }

    private function stintsToText(array $stints, array $pits, array $drvMap): string
    {
        $byDriver = [];
        foreach ($stints as $s) {
            $num = (int) ($s['driver_number'] ?? 0);
            $byDriver[$num][] = sprintf('%s(age %d, laps %d-%d)',
                F1Helper::normalizeCompound((string) ($s['compound'] ?? '')),
                (int) ($s['tyre_age_at_start'] ?? 0),
                (int) ($s['lap_start'] ?? 0),
                (int) ($s['lap_end'] ?? 0),
            );
        }

        $pitCount = [];
        foreach ($pits as $p) {
            $num = (int) ($p['driver_number'] ?? 0);
            $pitCount[$num] = ($pitCount[$num] ?? 0) + 1;
        }

        $lines = [];
        foreach ($byDriver as $num => $stintList) {
            $acronym = $drvMap[$num] ?? "#{$num}";
            $pits    = $pitCount[$num] ?? 0;
            $lines[] = "{$acronym}: " . implode(' → ', $stintList) . " ({$pits} stops)";
        }

        return implode("\n", $lines);
    }

    private function latestByDriver(array $items): array
    {
        $latest = [];
        foreach ($items as $item) {
            $num  = (int) ($item['driver_number'] ?? 0);
            $date = (string) ($item['date'] ?? '');
            if (!isset($latest[$num]) || $date > (string) ($latest[$num]['date'] ?? '')) {
                $latest[$num] = $item;
            }
        }
        return $latest;
    }

    private function cachedDrivers(int $sessionKey): array
    {
        $cKey = $this->cache->key('drivers', ['session_key' => $sessionKey]);
        return $this->cache->get($cKey) ?? $this->openF1->get('drivers', ['session_key' => $sessionKey]);
    }

    private function cachedStints(int $sessionKey): array
    {
        $cKey = $this->cache->key('stints', ['session_key' => $sessionKey]);
        return $this->cache->get($cKey) ?? $this->openF1->get('stints', ['session_key' => $sessionKey]);
    }

    private function cachedPits(int $sessionKey): array
    {
        $cKey = $this->cache->key('pits', ['session_key' => $sessionKey]);
        return $this->cache->get($cKey) ?? $this->openF1->get('pit', ['session_key' => $sessionKey]);
    }

}
