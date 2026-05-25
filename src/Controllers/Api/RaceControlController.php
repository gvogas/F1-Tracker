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

        // Shares the 'race_control' cache key with AiController so the two don't
        // each hit OpenF1 separately for the same data.
        return $this->json($response, $this->fetchCached('race_control', ['session_key' => $sessionKey], 10));
    }
}
