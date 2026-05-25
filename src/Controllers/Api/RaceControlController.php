<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class RaceControlController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $cKey = $this->cache->key('race-control', ['session_key' => $sessionKey]);

        return $this->cachedJson(
            $response,
            $cKey,
            10,
            fn(): array => $this->openF1->get('race_control', ['session_key' => $sessionKey]),
        );
    }
}
