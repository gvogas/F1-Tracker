<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class RaceControlController
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

        $cKey = $this->cache->key('race-control', ['session_key' => $sessionKey]);
        $data = $this->cache->get($cKey);

        if ($data === null) {
            $data = $this->openF1->get('race_control', ['session_key' => $sessionKey]);
            $this->cache->set($cKey, $data, 10);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }
}
