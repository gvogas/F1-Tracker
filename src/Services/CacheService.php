<?php

declare(strict_types=1);

namespace App\Services;

class CacheService
{
    private string $dir;

    public function __construct(string $cacheDir)
    {
        $this->dir = rtrim($cacheDir, '/');
        if (!is_dir($this->dir)) {
            mkdir($this->dir, 0755, true);
        }
    }

    public function get(string $key): ?array
    {
        $file = $this->filePath($key);

        if (!file_exists($file)) {
            return null;
        }

        $raw = file_get_contents($file);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['expires_at'], $data['payload'])) {
            return null;
        }

        if (time() > $data['expires_at']) {
            @unlink($file);
            return null;
        }

        return $data['payload'];
    }

    /**
     * Return the cached value for $key, or run $producer, cache its result and return it.
     *
     * @param callable():array $producer
     * @return array<mixed>
     */
    public function remember(string $key, int $ttl, callable $producer): array
    {
        $cached = $this->get($key);
        if ($cached !== null) {
            return $cached;
        }
        $value = $producer();
        $this->set($key, $value, $ttl);
        return $value;
    }

    public function set(string $key, array $payload, int $ttl): void
    {
        $file = $this->filePath($key);
        $data = json_encode([
            'expires_at' => time() + $ttl,
            'payload'    => $payload,
        ], JSON_UNESCAPED_UNICODE);

        // Atomic write via temp file to avoid partial reads
        $tmp = $file . '.tmp.' . getmypid();
        file_put_contents($tmp, $data, LOCK_EX);
        rename($tmp, $file);
    }

    public function key(string $endpoint, array $params = []): string
    {
        ksort($params);
        return md5($endpoint . ':' . http_build_query($params));
    }

    private function filePath(string $key): string
    {
        return $this->dir . '/' . $key . '.json';
    }
}
