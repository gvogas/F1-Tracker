<?php

declare(strict_types=1);

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Twig\Environment;

class PageController
{
    private const TITLES = [
        'home'        => 'F1 Tracker',
        'dashboard'   => 'Dashboard · F1 Tracker',
        'leaderboard' => 'Leaderboard · F1 Tracker',
        'profile'     => 'Profile · F1 Tracker',
        'races'       => 'Races · F1 Tracker',
        'race'        => 'Race · F1 Tracker',
    ];

    public function __construct(private readonly Environment $twig) {}

    public function home(Request $request, Response $response): Response
    {
        return $this->render($response, 'home/index.html.twig', ['title' => self::TITLES['home']]);
    }

    public function dashboard(Request $request, Response $response): Response
    {
        return $this->render($response, 'dashboard/index.html.twig', ['title' => self::TITLES['dashboard']]);
    }

    public function leaderboard(Request $request, Response $response): Response
    {
        return $this->render($response, 'leaderboard/index.html.twig', ['title' => self::TITLES['leaderboard']]);
    }

    public function profile(Request $request, Response $response): Response
    {
        return $this->render($response, 'profile/index.html.twig', ['title' => self::TITLES['profile']]);
    }

    public function races(Request $request, Response $response): Response
    {
        return $this->render($response, 'races/index.html.twig', ['title' => self::TITLES['races']]);
    }

    public function race(Request $request, Response $response): Response
    {
        return $this->render($response, 'race/index.html.twig', ['title' => self::TITLES['race']]);
    }

    private function render(Response $response, string $template, array $context = []): Response
    {
        $html = $this->twig->render($template, $context);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
