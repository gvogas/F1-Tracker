<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

class OpenF1Service
{
    private string $baseUrl;
    private int $timeout;

    public function __construct(string $baseUrl, int $timeout = 15)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    /**
     * Fetch an OpenF1 endpoint, retrying once on 429 with exponential back-off.
     *
     * @return array<mixed>
     */
    public function get(string $endpoint, array $params = []): array
    {
        $url = $this->baseUrl . '/' . ltrim($endpoint, '/');
        if ($params) {
            $url .= '?' . http_build_query($params);
        }

        $attempt = 0;
        $delays  = [0, 2, 4, 8]; // seconds before each attempt

        while ($attempt < count($delays)) {
            if ($delays[$attempt] > 0) {
                sleep($delays[$attempt]);
            }

            [$status, $body, $headers] = $this->curlGet($url);

            if ($status === 429) {
                $attempt++;
                if ($attempt < count($delays)) {
                    $retryAfter = isset($headers['retry-after']) ? (int) $headers['retry-after'] : 0;
                    if ($retryAfter > 0) {
                        $delays[$attempt] = min($retryAfter, 30);
                    }
                }
                continue;
            }

            if ($status >= 400) {
                throw new RuntimeException("OpenF1 returned HTTP {$status} for {$endpoint}");
            }

            $decoded = json_decode($body, true);
            if (!is_array($decoded)) {
                throw new RuntimeException("OpenF1 returned non-JSON for {$endpoint}");
            }

            return $decoded;
        }

        throw new RuntimeException("OpenF1 rate-limited after retries for {$endpoint}");
    }

    /** @return array{int, string, array<string, string>} [httpStatus, body, responseHeaders] */
    private function curlGet(string $url): array
    {
        $responseHeaders = [];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_USERAGENT      => 'F1-Tracker/1.0',
            CURLOPT_HEADERFUNCTION => function ($handle, $header) use (&$responseHeaders): int {
                if (str_contains($header, ':')) {
                    [$name, $value] = explode(':', $header, 2);
                    $responseHeaders[strtolower(trim($name))] = trim($value);
                }
                return strlen($header);
            },
        ]);

        $body   = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("cURL error: {$error}");
        }

        return [$status, $body, $responseHeaders];
    }
}
