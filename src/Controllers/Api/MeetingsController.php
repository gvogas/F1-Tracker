<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Helpers\F1Helper;
use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MeetingsController
{
    public function __construct(
        private readonly OpenF1Service $openF1,
        private readonly CacheService  $cache,
    ) {}

    public function index(Request $request, Response $response): Response
    {
        $year  = (int) ($request->getQueryParams()['year'] ?? date('Y'));
        $cKey  = $this->cache->key('meetings', ['year' => $year]);
        $data  = $this->cache->get($cKey);

        if ($data === null) {
            $raw   = $this->openF1->get('meetings', ['year' => $year]);
            $items = F1Helper::normalizeMeetings($raw);
            $data  = array_map(fn($m) => $m->toArray(), $items);
            $this->cache->set($cKey, $data, 3600);
        }

        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }
}
