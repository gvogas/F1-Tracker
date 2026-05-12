<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class WeatherController
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

        $cKey = $this->cache->key('weather', ['session_key' => $sessionKey]);
        $data = $this->cache->get($cKey);

        if ($data === null) {
            $raw     = $this->openF1->get('weather', ['session_key' => $sessionKey]);
            $weather = F1Helper::latestWeather($raw);
            $data    = $weather ? $weather->toArray() : [];
            $this->cache->set($cKey, $data, 30);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }
}
