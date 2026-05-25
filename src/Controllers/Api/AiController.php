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

class AiController extends ApiController
{
    private const MISTRAL  = 'mistralai/Mistral-7B-Instruct-v0.3';
    private const BART     = 'facebook/bart-large-cnn';
    private const FLAN_T5  = 'google/flan-t5-base';

    public function __construct(
        OpenF1Service $openF1,
        CacheService  $cache,
        private readonly HuggingFaceService $hf,
    ) {
        parent::__construct($openF1, $cache);
    }

    // ─── Goal 6: AI Race Commentator ─────────────────────────────────────────

    public function commentator(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        return $this->cachedAi($response, 'ai_commentator', $sessionKey, 30, function () use ($sessionKey): array {
            $tower   = $this->getTowerSnapshot($sessionKey);
            $rcMsgs  = $this->fetchCached('race_control', ['session_key' => $sessionKey], 30);
            $lastMsg = end($rcMsgs);
            $rcText  = $lastMsg ? ($lastMsg['message'] ?? '') : 'No race control messages.';

            $prompt = "You are an enthusiastic Formula 1 TV commentator. Based on the following live timing data, "
                . "provide 2-4 sentences of exciting live race commentary. Use driver surnames and team names. "
                . "Be dramatic but accurate.\n\nCurrent timing tower:\n"
                . $this->towerToText($tower)
                . "\n\nLatest race control: {$rcText}\n\nCommentary:";

            return ['commentary' => $this->hf->generate(self::MISTRAL, $prompt, 200)];
        });
    }

    // ─── Goal 7: Tyre Strategy Analyser ──────────────────────────────────────

    public function tyreStrategy(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        return $this->cachedAi($response, 'ai_tyre_strategy', $sessionKey, 120, function () use ($sessionKey): array {
            $stints  = $this->fetchCached('stints',  ['session_key' => $sessionKey], 60);
            $pits    = $this->fetchCached('pit',     ['session_key' => $sessionKey], 60);
            $rawDrv  = $this->fetchCached('drivers', ['session_key' => $sessionKey], 3600);
            $drvMap  = [];
            foreach (F1Helper::normalizeDrivers($rawDrv) as $d) {
                $drvMap[$d->number] = $d->acronym;
            }

            $stratText = $this->stintsToText($stints, $pits, $drvMap);
            $prompt    = "You are an F1 strategy analyst. Analyse the following tyre stint and pit stop data and explain "
                . "which driver used the best strategy and which lost the most time. Be concise (2-3 sentences).\n\n"
                . "Stint data:\n{$stratText}\n\nStrategy analysis:";

            return ['analysis' => $this->hf->generate(self::MISTRAL, $prompt, 250)];
        });
    }

    // ─── Goal 8: Race Control Explainer ──────────────────────────────────────

    public function raceControlExplain(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        return $this->cachedAi($response, 'ai_race_control', $sessionKey, 60, function () use ($sessionKey): array {
            $messages = $this->fetchCached('race_control', ['session_key' => $sessionKey], 30);

            if (empty($messages)) {
                return ['explanation' => 'No race control messages yet.'];
            }

            $text = implode('. ', array_map(
                fn($m) => ($m['message'] ?? '') . ' (lap ' . ($m['lap_number'] ?? '?') . ')',
                $messages
            ));

            return ['explanation' => $this->hf->summarise(self::BART, $text, 150)];
        });
    }

    // ─── Goal 9: Performance Analysis & Race Prediction ──────────────────────

    public function performance(Request $request, Response $response): Response
    {
        $sessionKey = $this->parseSessionKey($request);
        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        return $this->cachedAi($response, 'ai_performance', $sessionKey, 60, function () use ($sessionKey): array {
            $tower   = $this->getTowerSnapshot($sessionKey);
            $rawDrv  = $this->fetchCached('drivers', ['session_key' => $sessionKey], 3600);
            $drvMap  = [];
            foreach (F1Helper::normalizeDrivers($rawDrv) as $d) {
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

            $input = "Given this F1 race data, predict the likely final finishing order and explain the key factors: "
                . implode('; ', $paceLines);

            return [
                'prediction' => $this->hf->text2text(self::FLAN_T5, $input),
                'analysis'   => 'Based on current pace, gap trends, and tyre strategy.',
            ];
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Cache-or-generate wrapper shared by the four AI endpoints: serve a cached
     * result, else run $produce, cache it, and return JSON — mapping failures to 502.
     */
    private function cachedAi(Response $response, string $feature, int $sessionKey, int $ttl, callable $produce): Response
    {
        $cacheKey = $this->cache->key($feature, ['session_key' => $sessionKey]);
        $hit      = $this->cache->get($cacheKey);
        if ($hit !== null) {
            return $this->json($response, $hit);
        }

        try {
            $out = $produce();
            $this->cache->set($cacheKey, $out, $ttl);
            return $this->json($response, $out);
        } catch (Throwable $e) {
            return $this->error($response, $e->getMessage(), 502);
        }
    }

    private function parseSessionKey(Request $request): int
    {
        $body = (array) ($request->getParsedBody() ?? []);
        if (empty($body)) {
            $body = (array) (json_decode((string) $request->getBody(), true) ?? []);
        }
        return (int) ($body['session_key'] ?? 0);
    }

    /**
     * Lightweight per-driver snapshot for AI prompts. Reuses the same cached
     * streams the live tower writes, so AI polling adds no extra OpenF1 calls.
     */
    private function getTowerSnapshot(int $sessionKey): array
    {
        $p         = ['session_key' => $sessionKey];
        $positions = $this->fetchCached('position',  $p, 10);
        $intervals = $this->fetchCached('intervals', $p, 10);
        $laps      = $this->fetchCached('laps',      $p, 10);
        $stints    = $this->fetchCached('stints',    $p, 60);
        $pits      = $this->fetchCached('pit',       $p, 60);
        $rawDrv    = $this->fetchCached('drivers',   $p, 3600);

        $drvMap = [];
        foreach (F1Helper::normalizeDrivers($rawDrv) as $d) {
            $drvMap[$d->number] = $d->toArray();
        }

        $latestPos = F1Helper::latestByDriver($positions);
        $latestInt = F1Helper::latestByDriver($intervals);
        $latestLap = F1Helper::latestByDriver($laps);

        $stintsByDriver = [];
        foreach ($stints as $s) {
            $stintsByDriver[(int) ($s['driver_number'] ?? 0)][] = $s;
        }
        $pitsByDriver = [];
        foreach ($pits as $p) {
            $pitsByDriver[(int) ($p['driver_number'] ?? 0)][] = $p;
        }

        $rows = [];
        foreach ($latestPos as $num => $pos) {
            $intData   = $latestInt[$num] ?? [];
            $lapData   = $latestLap[$num] ?? [];
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
            $stops   = $pitCount[$num] ?? 0;
            $lines[] = "{$acronym}: " . implode(' → ', $stintList) . " ({$stops} stops)";
        }

        return implode("\n", $lines);
    }
}
