<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class SessionsController
{
    public function __construct(
        private readonly OpenF1Service $openF1,
        private readonly CacheService  $cache,
    ) {}

    public function index(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $meetingKey = (int) ($params['meeting_key'] ?? 0);

        if ($meetingKey === 0) {
            $response->getBody()->write(json_encode(['error' => 'meeting_key is required']));
            return $response->withStatus(400);
        }

        $cKey = $this->cache->key('sessions', ['meeting_key' => $meetingKey]);
        $data = $this->cache->get($cKey);

        if ($data === null) {
            $raw      = $this->openF1->get('sessions', ['meeting_key' => $meetingKey]);
            $sessions = F1Helper::normalizeSessions($raw);
            $data     = array_map(fn($s) => $s->toArray(), $sessions);
            $this->cache->set($cKey, $data, 3600);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }
}
