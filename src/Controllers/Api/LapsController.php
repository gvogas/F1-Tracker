<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class LapsController
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

        $apiParams = ['session_key' => $sessionKey];
        if (isset($params['date_start'])) {
            $apiParams['date_start'] = $params['date_start'];
        }

        $cKey = $this->cache->key('laps', $apiParams);
        $data = $this->cache->get($cKey);

        if ($data === null) {
            $data = $this->openF1->get('laps', $apiParams);
            $this->cache->set($cKey, $data, 5);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }
}
