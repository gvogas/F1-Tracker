# F1 Tracker

A live Formula 1 timing and stats web app powered by the [OpenF1 API](https://openf1.org) with an AI commentary layer via HuggingFace.

## Features

- **Live dashboard** — real-time timing tower with positions, gaps, DRS, tyre compounds and sector splits
- **Race replay** — scrub through any session with a 5× replay clock
- **Leaderboard** — full session results with driver headshots and team colours
- **Races** — full season calendar with past/upcoming race cards
- **AI commentary** — live race commentary, tyre strategy analysis, race control summary and finish prediction powered by HuggingFace models
- **Profile** — pick your favourite driver and team; highlighted everywhere in the app

## Stack

| Layer | Tech |
|---|---|
| Routing | Slim 4 |
| Templates | Twig 3 |
| DI | PHP-DI 7 |
| PHP | 8.2+ |
| Frontend | jQuery + vanilla JS |
| Data | OpenF1 API (server-side proxy) |
| AI | HuggingFace Inference API |
| Cache | File-based, per-endpoint TTLs |

## Getting started

**1. Clone and install**
```bash
git clone https://github.com/gvogas/F1-Tracker.git
cd F1-Tracker
composer install
```

**2. Configure environment**
```bash
cp .env.example .env
```
Edit `.env` and add your HuggingFace token (free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)):
```
HF_TOKEN=hf_your_token_here
```

**3. Run**
```bash
php -S localhost:8080
```

Open [http://localhost:8080](http://localhost:8080).

## Project structure

```
├── src/
│   ├── Controllers/Api/   # JSON endpoints (/api/*)
│   ├── Controllers/       # Page controllers (Twig)
│   ├── Models/            # Typed DTOs (Meeting, Session, Driver, Weather)
│   ├── Services/          # OpenF1, HuggingFace, Cache
│   ├── Helpers/           # Data normalisation
│   └── Middleware/        # JSON headers, security headers
├── templates/             # Twig page templates
├── core/                  # Shared JS (API client, tower UI, utils)
├── features/              # Page-specific JS
├── css/
├── cache/                 # Runtime cache (gitignored)
└── index.php              # Slim bootstrap + all routes
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/meetings` | Season meeting list |
| GET | `/api/sessions` | Sessions for a meeting |
| GET | `/api/drivers` | Driver list for a session |
| GET | `/api/results` | Session results with driver info |
| GET | `/api/tower` | Live timing tower snapshot |
| GET | `/api/weather` | Latest weather for a session |
| GET | `/api/laps` | Lap data |
| GET | `/api/race-control` | Race control messages |
| POST | `/api/ai/commentator` | Live race commentary (Mistral-7B) |
| POST | `/api/ai/tyre-strategy` | Strategy analysis (Mistral-7B) |
| POST | `/api/ai/race-control-explain` | Stewards summary (bart-large-cnn) |
| POST | `/api/ai/performance` | Finish prediction (flan-t5-base) |

## Data

All OpenF1 requests are proxied through PHP — no API calls from the browser. Responses are cached server-side:

| Data | TTL |
|---|---|
| Tower, laps | 5 s |
| Weather, race control | 30 s |
| Meetings, sessions, drivers, results | 1 hour |
