<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

class HuggingFaceService
{
    private const BASE = 'https://api-inference.huggingface.co/models/';
    private const DEFAULT_TIMEOUT = 60;

    public function __construct(private readonly string $apiKey) {}

    /**
     * Text generation — returns the generated string.
     * Suitable for: mistralai/Mistral-7B-Instruct-v0.3
     */
    public function generate(string $model, string $prompt, int $maxTokens = 300): string
    {
        $payload = json_encode([
            'inputs'     => $prompt,
            'parameters' => [
                'max_new_tokens'   => $maxTokens,
                'temperature'      => 0.7,
                'return_full_text' => false,
            ],
        ]);

        $raw = $this->post($model, $payload);

        // Response is an array of generation objects
        if (isset($raw[0]['generated_text'])) {
            return trim((string) $raw[0]['generated_text']);
        }

        // Some models return plain string
        if (is_string($raw)) {
            return trim($raw);
        }

        throw new RuntimeException("Unexpected HuggingFace generate response for {$model}");
    }

    /**
     * Summarisation — returns the summary string.
     * Suitable for: facebook/bart-large-cnn
     */
    public function summarise(string $model, string $text, int $maxLength = 200): string
    {
        $payload = json_encode([
            'inputs'     => $text,
            'parameters' => [
                'max_length' => $maxLength,
                'min_length' => 40,
            ],
        ]);

        $raw = $this->post($model, $payload);

        if (isset($raw[0]['summary_text'])) {
            return trim((string) $raw[0]['summary_text']);
        }

        throw new RuntimeException("Unexpected HuggingFace summarise response for {$model}");
    }

    /**
     * Text-to-text generation — returns the generated text.
     * Suitable for: google/flan-t5-base
     */
    public function text2text(string $model, string $input): string
    {
        $payload = json_encode([
            'inputs'     => $input,
            'parameters' => ['max_new_tokens' => 256],
        ]);

        $raw = $this->post($model, $payload);

        if (isset($raw[0]['generated_text'])) {
            return trim((string) $raw[0]['generated_text']);
        }

        throw new RuntimeException("Unexpected HuggingFace text2text response for {$model}");
    }

    /** @return array<mixed> */
    private function post(string $model, string $jsonPayload): array
    {
        $url = self::BASE . $model;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::DEFAULT_TIMEOUT,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $jsonPayload,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);

        $body   = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("cURL error calling HuggingFace: {$error}");
        }

        if ($status === 503) {
            // Model loading — common on free tier, surface a useful error
            throw new RuntimeException("HuggingFace model is loading, try again in a moment.");
        }

        if ($status >= 400) {
            throw new RuntimeException("HuggingFace returned HTTP {$status}: {$body}");
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException("HuggingFace returned non-JSON: {$body}");
        }

        return $decoded;
    }
}
