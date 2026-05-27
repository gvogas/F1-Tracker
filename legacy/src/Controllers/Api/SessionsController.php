<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class SessionsController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $meetingKey = (int) ($request->getQueryParams()['meeting_key'] ?? 0);

        if ($meetingKey === 0) {
            return $this->error($response, 'meeting_key is required', 400);
        }

        $cKey = $this->cache->key('sessions', ['meeting_key' => $meetingKey]);

        return $this->cachedJson($response, $cKey, 3600, function () use ($meetingKey): array {
            $raw = $this->openF1->get('sessions', ['meeting_key' => $meetingKey]);
            return array_map(fn($s) => $s->toArray(), F1Helper::normalizeSessions($raw));
        });
    }
}
