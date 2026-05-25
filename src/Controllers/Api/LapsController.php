<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class LapsController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $params     = $request->getQueryParams();
        $sessionKey = (int) ($params['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        $apiParams = ['session_key' => $sessionKey];
        if (isset($params['date_start'])) {
            $apiParams['date_start'] = $params['date_start'];
        }

        $cKey = $this->cache->key('laps', $apiParams);

        return $this->cachedJson(
            $response,
            $cKey,
            5,
            fn(): array => $this->openF1->get('laps', $apiParams),
        );
    }
}
