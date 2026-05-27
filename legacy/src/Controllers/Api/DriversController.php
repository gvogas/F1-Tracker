<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class DriversController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $sessionKey = (int) ($request->getQueryParams()['session_key'] ?? 0);

        if ($sessionKey === 0) {
            return $this->error($response, 'session_key is required', 400);
        }

        // Share the raw 'drivers' cache with the tower/AI controllers, then
        // normalise for output (avoids a cache-shape collision on the shared key).
        $raw  = $this->fetchCached('drivers', ['session_key' => $sessionKey], 3600);
        $data = array_map(fn($d) => $d->toArray(), F1Helper::normalizeDrivers($raw));

        return $this->json($response, $data);
    }
}
