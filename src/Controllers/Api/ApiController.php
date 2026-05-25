<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Services\CacheService;
use App\Services\OpenF1Service;
use Psr\Http\Message\ResponseInterface as Response;
use Throwable;

/**
 * Shared plumbing for the JSON API controllers: response writing, the
 * required-param error, and the cache-backed fetch helpers that proxy OpenF1.
 */
abstract class ApiController
{
    public function __construct(
        protected readonly OpenF1Service $openF1,
        protected readonly CacheService  $cache,
    ) {}

    protected function json(Response $response, mixed $data): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response;
    }

    protected function error(Response $response, string $message, int $status): Response
    {
        $response->getBody()->write(json_encode(['error' => $message], JSON_UNESCAPED_UNICODE));
        return $response->withStatus($status);
    }

    /** Cache an endpoint's produced output, returning JSON. */
    protected function cachedJson(Response $response, string $cacheKey, int $ttl, callable $producer): Response
    {
        return $this->json($response, $this->cache->remember($cacheKey, $ttl, $producer));
    }

    /**
     * Cache-backed OpenF1 fetch keyed by endpoint+params. Shared across
     * controllers via stable cache keys. May throw on upstream failure.
     *
     * @return array<mixed>
     */
    protected function fetchCached(string $endpoint, array $params, int $ttl): array
    {
        $key = $this->cache->key($endpoint, $params);
        return $this->cache->remember($key, $ttl, fn() => $this->openF1->get($endpoint, $params));
    }

    /**
     * Like fetchCached(), but degrades to the last cached value (or empty)
     * instead of throwing — used by the live tower so one bad stream doesn't
     * blank the whole board.
     *
     * @return array<mixed>
     */
    protected function fetchCachedSafe(string $endpoint, array $params, int $ttl): array
    {
        $key = $this->cache->key($endpoint, $params);
        try {
            return $this->cache->remember($key, $ttl, fn() => $this->openF1->get($endpoint, $params));
        } catch (Throwable $e) {
            return $this->cache->get($key) ?? [];
        }
    }
}
