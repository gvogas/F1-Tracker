# F1 Live — Real-Time Timing & Track Map

A live Formula 1 **real-time data visualization** web app powered by the
[OpenF1 API](https://openf1.org), with a speed-controlled race replay and a light
AI commentary accent. Built for a hackathon — the centerpiece is a live timing
tower and an animated track map.

> Rebuilt on Next.js. The original PHP/Slim version is preserved under [`legacy/`](./legacy).

## Features

- **Live timing tower** — positions, gaps, intervals, DRS, tyre compounds, sector
  splits and pit counts that reorder in real time with smooth FLIP animation.
- **Track map** — cars ease around a circuit traced from live GPS telemetry, with
  team colours, a gold ring on the leader and motion trails (HTML5 canvas).
- **Race replay** — auto-replays a recent race with a play/pause/scrub clock at up
  to 30× speed, so there's always motion. Switches to true-live when a session is on.
- **AI commentary** — optional live commentary on the timing feed; degrades to a
  placeholder when no token is configured (the visualization never depends on it).
- **Favourite driver** — click a row to highlight your driver everywhere.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion (tower) + Canvas 2D + requestAnimationFrame (map) |
| Data | OpenF1 API (proxied through Next.js route handlers) |
| AI | HuggingFace Inference (configurable, optional) |
| Cache | In-memory, per-endpoint TTLs |

## Getting started

```bash
npm install
cp .env.example .env   # optional: add HF_TOKEN for AI commentary
npm run dev            # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) and click **Open Live
Dashboard**. It auto-selects a session (a live one if any, otherwise it replays a
recent race) and starts animating.

### Demo mode (offline / restricted networks)

If the host can't reach `api.openf1.org` (e.g. a locked-down network or CI), run
with synthetic data so the full visualization still works:

```bash
DEMO_DATA=1 npm run dev
```

This fabricates a moving 20-car field and a circuit entirely server-side; no
external calls are made. Real OpenF1 behaviour is unaffected when the flag is off.

### Configuration

| Var | Purpose |
|---|---|
| `OPENF1_BASE_URL` | OpenF1 base URL (default `https://api.openf1.org/v1`). |
| `DEMO_DATA` | `1` to serve synthetic data instead of calling OpenF1. |
| `AI_PROVIDER` | `huggingface-router` (default), `huggingface-legacy`, or `none`. |
| `AI_MODEL` | Model id for commentary. |
| `AI_ROUTER_URL` | Chat-completions endpoint for the router provider. |
| `HF_TOKEN` | HuggingFace token; without it, commentary shows a placeholder. |

## Project structure

```
app/
  page.tsx                landing
  dashboard/page.tsx      the live dashboard
  api/*/route.ts          OpenF1 proxy + tower assembly + AI commentary
lib/
  openf1/client.ts        fetch client (operator-aware query, Retry-After backoff)
  cache.ts                in-memory TTL cache
  f1/                      assembleTower, format helpers, windows, normalize
  demo/generate.ts        synthetic data for DEMO_DATA=1
  ai/commentator.ts       isolated, env-configurable AI accent
hooks/                    useReplayClock, useTowerFeed, useTrackData, …
components/                TimingTower, TrackMap, ReplayControls, SessionPicker, …
legacy/                    original PHP/Slim app (reference only)
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/meetings?year=` | Season meeting list |
| GET | `/api/sessions?meeting_key=` | Sessions for a meeting |
| GET | `/api/drivers?session_key=` | Driver list for a session |
| GET | `/api/results?session_key=` | Session results with driver info |
| GET | `/api/tower?session_key=[&date=ISO]` | Assembled timing tower (live or replay) |
| GET | `/api/location?session_key=[&date=ISO]` | Car positions |
| GET | `/api/track-outline?session_key=[&date=ISO]` | Downsampled circuit points |
| GET | `/api/weather?session_key=` | Latest weather |
| GET | `/api/race-control?session_key=` | Race control messages |
| POST | `/api/ai/commentator` | Live commentary (`{ session_key, date? }`) |

Replay is pure timestamp windowing: the client advances a clock and passes `date`
to `/api/tower` and `/api/location`, which filter OpenF1 by time. The tower serves
its last good snapshot if upstream fails.
