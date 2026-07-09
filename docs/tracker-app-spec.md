# Self-Hosted TV/Movie Tracker PWA — Functional Spec v2

Multi-user (household), Docker-hosted replacement for a Trakt-style tracker, exposed outside the LAN via an existing Cloudflare Tunnel already running on your Unraid server. Built from screenshots of the reference app. This doc is the source of truth to hand to Claude Code for scaffolding and iterating on the build.

---

## 1. Goal & Scope

Track watched/watching status for TV shows and movies per household member, surface upcoming episode/movie releases, and do it all self-hosted via Docker with no ongoing dependency on a third-party service that could shut down. Deliberately smaller in scope than the reference app — no social features, no ratings/reviews, no streaming-availability lookups. Just: what am I watching, what's next, what's coming — per person in the household.

**Multi-user, real auth required.** Because this is reachable from the public internet through your tunnel (not just LAN-trusted), it needs actual login, not a network-level assumption of trust. Accounts are created manually by you (no self-registration UI) — see Section 4. Each user's watch data is fully private; no household member can see another's watch list or status.

---

## 2. Tech Stack

- **Single Laravel project** using the official Laravel React starter kit (Laravel 12+, Inertia.js, React 19, TypeScript, Tailwind, shadcn/ui). No separate backend/frontend split, no separate REST API — Laravel controllers return Inertia responses (page component + props), React renders them client-side after the first load. Frontend code lives in `resources/js/`.
- **Auth:** standard Laravel session-based auth (the `web` guard), which is what the starter kit ships with — no Sanctum needed, since Inertia pages and the backend share the same origin by definition. Configure a long session lifetime (see Section 8 — PWA installs shouldn't need to log in repeatedly). The starter kit includes a self-registration flow by default; **that gets removed/disabled** since accounts are created manually (Section 4/10).
- **DB:** PostgreSQL, its own container with a named volume.
- **Queue/Scheduler:** Laravel's built-in scheduler (cron-driven) for the nightly TMDB sync job; `database` queue driver (no Redis needed at this scale).
- **PWA layer:** `vite-plugin-pwa` (Workbox) added on top of the starter kit's existing Vite config, handling manifest.json + service worker + install prompts. Offline caching targets Inertia page-visit responses and poster/still images, not a separate REST API.
- **Exposure:** No tunnel container in this stack — you already run `cloudflared` on your Unraid server. This compose file just needs to expose the `web` service on the Docker network (or a fixed host port) so your existing tunnel config can point a route at it. Since your tunnel already terminates HTTPS, the app gets real HTTPS end-to-end, which service workers require.
- **Containers (docker-compose):**
  - `app` — PHP-FPM running the Laravel/Inertia app
  - `web` — nginx, serves the app (Laravel routes + built Vite assets), reachable by your existing `cloudflared` container
  - `db` — Postgres, named volume for data
  - `scheduler` — same app image, runs `php artisan schedule:work`
  - `queue` — same app image, runs `php artisan queue:work`

---

## 3. Data Sources & External ID Strategy

- **TMDB** for all metadata (show/movie search, episode lists, air dates, runtimes, images) in v1.
- **Trakt** deferred until API approval comes through, added as a second provider later — not blocking anything now because of the mapping table below.
- **`media_external_ids` table:** `(id, media_type[show|movie], media_id, provider[tmdb|trakt|...], external_id)`. Your own DB is the source of truth; providers are just lookup keys attached to it.

---

## 4. Data Model

Show/Season/Episode/Movie are **shared metadata** — one row per title regardless of who's tracking it, so the household never fetches or stores the same TMDB data twice. Watched status and list membership are **per-user**, split into their own tracking tables.

**User**

- `id`, `name`, `email`, `password_hash`

**Show** (shared)

- `id`, `title`, `poster_image_url`, `overview`
- has many `media_external_ids`

**Season** (shared)

- `id`, `show_id`, `season_number`, `episode_count` (cached from TMDB)

**Episode** (shared)

- `id`, `show_id`, `season_number`, `episode_number`, `title`, `still_image_url`, `overview`, `air_date`, `runtime_minutes`

**Movie** (shared)

- `id`, `title`, `poster_image_url`, `overview`, `release_date`, `runtime_minutes`
- has many `media_external_ids`

**UserShowTracking** (per-user)

- `id`, `user_id`, `show_id`, `status`: enum `watching | watch_later | finished | stopped`

**UserEpisodeWatch** (per-user)

- `id`, `user_id`, `episode_id`, `watched` (bool), `watched_date` (nullable, auto-set on toggle, editable)

**UserMovieTracking** (per-user)

- `id`, `user_id`, `movie_id`, `watched` (bool), `watched_date` (nullable, auto-set on toggle, editable)

---

## 5. Navigation & Screens

Bottom nav (mobile): **Shows | Movies | Search | Profile**. All watched-status and list-membership views are scoped to the logged-in user; the underlying show/episode/movie metadata is shared across the household.

### Shows tab

- **Watch List** sub-tab, two view modes toggled by an icon:
  - _List view_: sections — **Watch Next** (shows with an unwatched episode ready, for this user), **Watched History** (this user's recent watched log), **Watch Later** (shows this user is behind on). Each row: poster thumb, show name (tappable → detail), `S##|E##`, episode title, badge (`NEW`/`PREMIERE` if applicable), watched-toggle circle.
  - _Grid view_: poster grid grouped by this user's `status` on `UserShowTracking` — Watching / Watch Later / Finished / Stopped — with a thin colored bar under each poster.
- **Upcoming** sub-tab: episodes from shows this user tracks with future `air_date`, grouped by date (or "X days" for far-future), watched-toggle per row.

### Movies tab

- **Watch List** sub-tab: "Watch Next" grid of this user's untracked-as-watched movies; "Browse All Movies" → full grid grouped **Watched / Not Watched** (per user).
- **Upcoming** sub-tab: movies this user tracks with future `release_date`, grouped (e.g. "Later"), title + countdown ("X days").

### Show Detail

- Header: backdrop image, title, season count.
- Tabs: **About** (overview text) / **Episodes**
- Episodes tab: "Continue tracking" quick-access to this user's next unwatched episode; **All Episodes** grouped by season (collapsible), season header shows `watched/total` count for this user + a "mark whole season watched" action; expanded season lists episodes with thumbnail, `S##|E##`, title, watched-toggle.
- Tapping an episode opens the **Episode Quick View**: still image, `S##|E##`, title, overview, air date, watched-toggle, watched date (auto-filled on toggle, editable).

### Movie Detail

- Header: poster, title, release date, watched-toggle (this user).
- **About** tab: overview text only.

### Search

- Search bar, results list (poster thumb, title, type icon), add/track action (adds to the logged-in user's tracking — creates the shared Show/Movie row first if the household hasn't seen this title before). No Users/Groups tabs — no social layer.

### Profile

- Login-gated. Stats for the logged-in user: total watch time (sum of `runtime_minutes` across this user's watched episodes + movies), episodes watched count.

---

## 6. Background Jobs

- Nightly scheduled job: for each _shared_ tracked show, refresh season/episode list from TMDB (new episodes, updated/confirmed air dates, runtimes).
- Nightly scheduled job: refresh release dates and runtimes for tracked movies that don't have confirmed values yet.
- Upcoming feed is a query, not a stored table: episodes/movies where `air_date`/`release_date >= today` **and** the current user tracks the parent show/movie, sorted ascending.

---

## 7. Yamtrack Import

Per-user, one-time import command/UI reading a Yamtrack CSV export, run while logged in as the user whose history it is. Known columns: `media_id`, `source` (tmdb/mal/mangaupdates/igdb/openlibrary/hardcover/comicvine/manual), `media_type` (tv/season/episode/movie/anime/manga/game/book/comic), `title` (optional, auto-fetched if blank), `image_url` (optional, auto-fetched if blank), `season_number`, `episode_number`, `score` (0–10).

Rows with `source=tmdb` map directly into `media_external_ids` — the importer finds-or-creates the shared Show/Episode/Movie row, then creates the per-user tracking row against the importing user's `user_id`. **Action item:** once you have an actual export file in hand, have Claude Code inspect the real headers before writing the importer — worth confirming against a live sample rather than this doc alone.

---

## 8. PWA & Responsive Requirements

- Manifest + service worker via `vite-plugin-pwa`. Installable, works offline for cached data.
- **Persistent login:** log in once, stay logged in — no repeated login on each PWA launch. Configure Laravel's session cookie (`config/session.php`) with a long/effectively non-expiring lifetime, rather than the framework's short default, so the standalone PWA session survives across launches the same way an always-open browser tab would. Session ends only on explicit logout, not on a timer.
- **Mobile layout** (matches your screenshots): bottom tab bar, single-column stacked cards.
- **Desktop/large-screen layout**: improvise a distinct layout (e.g. sidebar nav, multi-column grids) and iterate on it as we go rather than locking it down up front.
- Offline: cache the JS/CSS/font shell and poster/still images — this works the same as any Vite app regardless of Inertia. Full offline _browsing_ of previously-viewed lists, and queuing watched-toggle _writes_ made offline, are both harder with Inertia than they'd be with a decoupled REST API — every Inertia page visit is a request to Laravel by design, so it's not naturally offline-first the way a plain SPA+API is. Keep both as Phase 2 stretch goals; don't block v1 on them. If they turn out to matter later, the pragmatic fix is exposing a few plain JSON endpoints for just those specific interactions rather than reworking the whole app off Inertia.

---

## 9. Interaction Behaviors

- Tap watched-toggle circle → toggle watched for the logged-in user (white/unwatched ↔ green/watched).
- Tap show/movie name pill → navigate to detail page.
- Tap season header's checkmark → mark/unmark entire season watched for this user.
- Grid/List icon → switch Watch List display mode.
- **Phase 2 (flagged for later, define screen-by-screen with Claude Code as you go):** swipe left/right on an episode row in Watch Next/Upcoming lists toggles watched, same effect as tapping the circle.

---

## 10. Suggested Build Order (for Claude Code)

1. Scaffold the Laravel project using the official React starter kit (Inertia), + docker-compose skeleton (app, web, db/Postgres, boots and health-checks)
2. Migrations: users, shows, seasons, episodes, movies, media_external_ids, user_show_tracking, user_episode_watches, user_movie_tracking
3. Auth: strip the starter kit's self-registration route/page, configure a long-lived session, add an artisan command for manually creating household user accounts
4. TMDB provider service behind a clean interface (search, fetch show/season/episode incl. runtime, fetch movie incl. runtime)
5. Show/Movie tracking scoped to the logged-in user (add to list, set status) via Inertia form requests/controllers
6. Episode watched-toggle + season bulk-toggle actions, scoped per user
7. Scheduler job: nightly TMDB refresh → populates the Upcoming query
8. `vite-plugin-pwa` added to the existing Vite config; nav shells for Shows/Movies/Search/Profile as Inertia pages in `resources/js/pages`
9. Watch List screens (list + grid view toggle)
10. Upcoming screens (Shows + Movies)
11. Show/Movie detail pages + Episode Quick View
12. Profile stats (watch time from runtime_minutes, episode count)
13. Yamtrack CSV importer (once you have a real sample export)
14. Expose `web` on the Docker network / a fixed port and point your existing `cloudflared` route at it
15. Responsive/desktop layout pass, iterated as we go
16. Swipe-to-mark-watched gesture (Phase 2)
