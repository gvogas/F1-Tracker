<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MeetingsController extends ApiController
{
    public function index(Request $request, Response $response): Response
    {
        $year = (int) ($request->getQueryParams()['year'] ?? date('Y'));
        $cKey = $this->cache->key('meetings', ['year' => $year]);

        return $this->cachedJson($response, $cKey, 3600, function () use ($year): array {
            $raw = $this->openF1->get('meetings', ['year' => $year]);
            return array_map(fn($m) => $m->toArray(), F1Helper::normalizeMeetings($raw));
        });
    }
}
