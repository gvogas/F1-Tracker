<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class WeatherController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $cKey = $this->cache->key('weather', ['session_key' => $sessionKey]);

        return $this->cachedJson($response, $cKey, 30, function () use ($sessionKey): array {
            $raw     = $this->openF1->get('weather', ['session_key' => $sessionKey]);
            $weather = F1Helper::latestWeather($raw);
            return $weather ? $weather->toArray() : [];
        });
    }
}
