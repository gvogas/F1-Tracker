<?php

declare(strict_types=1);

use App\Controllers\Api\AiController;
use App\Controllers\Api\DriversController;
use App\Controllers\Api\LapsController;
use App\Controllers\Api\LocationController;
use App\Controllers\Api\MeetingsController;
use App\Controllers\Api\RaceControlController;
use App\Controllers\Api\ResultsController;
use App\Controllers\Api\SessionsController;
use App\Controllers\Api\TowerController;
use App\Controllers\Api\WeatherController;
use App\Controllers\PageController;
use App\Middleware\JsonMiddleware;
use App\Middleware\SecurityHeadersMiddleware;
use App\Services\CacheService;
use App\Services\HuggingFaceService;
use App\Services\OpenF1Service;
use DI\Container;
use Slim\App;
use Slim\Exception\HttpNotFoundException;
use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

require __DIR__ . '/vendor/autoload.php';

// ─── Environment ────────────────────────────────────────────────────────────────

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// ─── DI Container ───────────────────────────────────────────────────────────────

$container = new Container();

$container->set(CacheService::class, function () {
    return new CacheService(__DIR__ . '/cache');
});

$container->set(OpenF1Service::class, function () {
    $base = $_ENV['OPENF1_BASE_URL'] ?? 'https://api.openf1.org/v1';
    return new OpenF1Service($base);
});

$container->set(HuggingFaceService::class, function () {
    $key = $_ENV['HF_TOKEN'] ?? $_ENV['HF_API_KEY'] ?? '';
    return new HuggingFaceService($key);
});

$container->set(Environment::class, function () {
    $loader = new FilesystemLoader(__DIR__ . '/templates');
    return new Environment($loader, [
        'cache'       => false, // enable __DIR__ . '/var/twig' in production
        'auto_reload' => true,
    ]);
});

// Page controller depends on Twig
$container->set(PageController::class, function (Container $c) {
    return new PageController($c->get(Environment::class));
});

// API controllers — all depend on OpenF1 + Cache
foreach ([
    MeetingsController::class,
    SessionsController::class,
    DriversController::class,
    ResultsController::class,
    WeatherController::class,
    LapsController::class,
    RaceControlController::class,
    LocationController::class,
] as $class) {
    $container->set($class, function (Container $c) use ($class) {
        return new $class($c->get(OpenF1Service::class), $c->get(CacheService::class));
    });
}

$container->set(TowerController::class, function (Container $c) {
    return new TowerController($c->get(OpenF1Service::class), $c->get(CacheService::class));
});

$container->set(AiController::class, function (Container $c) {
    return new AiController(
        $c->get(OpenF1Service::class),
        $c->get(CacheService::class),
        $c->get(HuggingFaceService::class),
    );
});

// ─── App ──────────────────────────────────────────────────────────────────────

AppFactory::setContainer($container);
$app = AppFactory::create();

$app->add(new SecurityHeadersMiddleware());

$errorMiddleware = $app->addErrorMiddleware(false, false, false);
$errorMiddleware->setErrorHandler(HttpNotFoundException::class, function ($request, $exception) use ($app) {
    $response = $app->getResponseFactory()->createResponse(404);
    $response->getBody()->write('{"error":"Not found"}');
    return $response->withHeader('Content-Type', 'application/json');
});
$errorMiddleware->setErrorHandler(RuntimeException::class, function ($request, $exception) use ($app) {
    $response = $app->getResponseFactory()->createResponse(503);
    $response->getBody()->write(json_encode(['error' => $exception->getMessage()]));
    return $response->withHeader('Content-Type', 'application/json');
}, true);

// ─── Page routes ──────────────────────────────────────────────────────────────

$app->get('/',            [PageController::class, 'home']);
$app->get('/home',        [PageController::class, 'home']);
$app->get('/dashboard',   [PageController::class, 'dashboard']);
$app->get('/leaderboard', [PageController::class, 'leaderboard']);
$app->get('/profile',     [PageController::class, 'profile']);
$app->get('/races',       [PageController::class, 'races']);
$app->get('/race',        [PageController::class, 'race']);

// ─── API routes (/api/*) ──────────────────────────────────────────────────────────

$app->group('/api', function (RouteCollectorProxy $group) {
    // Data endpoints (GET)
    $group->get('/meetings',      [MeetingsController::class,    'index']);
    $group->get('/sessions',      [SessionsController::class,    'index']);
    $group->get('/drivers',       [DriversController::class,     'index']);
    $group->get('/results',       [ResultsController::class,     'index']);
    $group->get('/weather',       [WeatherController::class,     'index']);
    $group->get('/tower',         [TowerController::class,       'index']);
    $group->get('/laps',          [LapsController::class,        'index']);
    $group->get('/race-control',  [RaceControlController::class, 'index']);
    $group->get('/location',      [LocationController::class,    'index']);
    $group->get('/track-outline', [LocationController::class,    'outline']);

    // AI endpoints (POST)
    $group->post('/ai/commentator',          [AiController::class, 'commentator']);
    $group->post('/ai/tyre-strategy',        [AiController::class, 'tyreStrategy']);
    $group->post('/ai/race-control-explain', [AiController::class, 'raceControlExplain']);
    $group->post('/ai/performance',          [AiController::class, 'performance']);
})->add(new JsonMiddleware());

$app->run();
