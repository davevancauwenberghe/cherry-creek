# Cherry Creek

The official website for **Cherry Creek**, a small, whitelisted Minecraft Java Edition survival community.

- Site: <https://cherrycreek.app>
- Minecraft: `play.cherrycreek.app`
- Map: <https://map.cherrycreek.app>

## What's inside

| Piece             | Choice                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| Framework         | [Astro 7](https://astro.build) with TypeScript, pages prerendered to static HTML    |
| Styling           | Tailwind CSS 4 (design tokens in `src/styles/global.css`)                           |
| Server            | Astro's standalone Node adapter, used only for `/api/status` and `/healthz`         |
| Fonts             | Bricolage Grotesque, Geist and Pixelify Sans, self-hosted (no third-party requests) |
| Client JavaScript | One ~5 kB bundle: copy buttons, live status, mobile menu, scroll reveals            |

There is no database, CMS, analytics, cookie or secret.

## Requirements

Node.js **22.23.4 or newer** (see `.nvmrc`) and npm.

## Development

```bash
npm install
cp .env.example .env    # optional: the defaults work
npm run dev             # http://localhost:4321
```

| Command            | What it does                                                 |
| ------------------ | ------------------------------------------------------------ |
| `npm run dev`      | Development server with hot reload                           |
| `npm run build`    | Production build into `dist/`                                |
| `npm run preview`  | Run the production build locally (reads `.env`)              |
| `npm run lint`     | ESLint                                                       |
| `npm run check`    | Type-check Astro and TypeScript files                        |
| `npm test`         | Unit tests for the status protocol, config and cache         |
| `npm run format`   | Format with Prettier                                         |
| `npm run validate` | Lint, type-check, test and build in one go                   |
| `npm run art`      | Regenerate the placeholder artwork, favicon and social image |

## Project layout

```
src/
  config/site.ts        Names, addresses and links (single source of truth)
  config/rules.ts       Community rules (empty until you add them)
  components/           One component per page section, plus shared pieces
  layouts/              Base (head, nav, footer) and Page (text pages)
  pages/                index, guide, rules, privacy, 404, api/status, healthz
  lib/minecraft/ping.ts Minecraft status protocol client (no dependencies)
  lib/status/           Environment config and cached status service
  scripts/              Small browser scripts
  assets/art/           Generated placeholder artwork
  assets/screenshots/   Drop real screenshots here
scripts/generate-art.mjs  Draws the placeholder artwork
deploy/                 Example Apache virtual host
tests/                  Node test runner tests
```

## Editing content

- **Links and addresses:** `src/config/site.ts` (or the `PUBLIC_*` variables below).
- **Section copy:** each section is a component in `src/components/`. Server figures (starting balance, claim blocks and so on) live at the top of `ServerInfo.astro` and in `src/pages/guide.astro`.
- **Rules:** add entries to `src/config/rules.ts`. The `/rules` page fills in and the footer link appears on the next build. Until then the page points visitors to Discord and is hidden from search engines.
- **Screenshots:** the hero and map card use original illustrations so that nothing is passed off as real gameplay. Add `hero.jpg` and/or `map.jpg` to `src/assets/screenshots/` and they replace the illustrations automatically. See the README in that folder.
- **New pages:** add a file to `src/pages/` using the `Page` layout. It is added to the sitemap automatically.

## Configuration

All settings are environment variables; `.env.example` documents each one.

| Variable                | When        | Default                         | Purpose                                                   |
| ----------------------- | ----------- | ------------------------------- | --------------------------------------------------------- |
| `SITE_URL`              | build       | `https://cherrycreek.app`       | Canonical origin for links, Open Graph and sitemap        |
| `PUBLIC_SERVER_ADDRESS` | build + run | `play.cherrycreek.app`          | Address shown to players and sent in the status handshake |
| `PUBLIC_MAP_URL`        | build       | `https://map.cherrycreek.app`   | BlueMap link                                              |
| `PUBLIC_DISCORD_URL`    | build       | `https://discord.gg/dRxSt8Bt9t` | Discord invite                                            |
| `STATUS_ENABLED`        | run         | `true`                          | `false` switches live status off                          |
| `MC_STATUS_HOST`        | run         | _(server address)_              | Host the website connects to for status                   |
| `MC_STATUS_PORT`        | run         | `25565`                         | Port for the status check                                 |
| `STATUS_CACHE_SECONDS`  | run         | `45`                            | How long a result is reused (10 to 600)                   |
| `STATUS_TIMEOUT_MS`     | run         | `3000`                          | Network timeout (500 to 10000)                            |
| `HOST` / `PORT`         | run         | `0.0.0.0` / `4321` in Docker    | Where the Node server listens                             |

Build-time values are baked into the static HTML, so changing them needs a rebuild. Run-time values only need a restart.

## Live server status

`GET /api/status` returns:

```json
{
  "state": "online",
  "players": { "online": 3, "max": 10 },
  "version": "Paper 26.3",
  "checkedAt": "2026-11-11T13:41:47.727Z",
  "lastSuccessAt": "2026-11-11T13:41:47.727Z",
  "ttl": 45
}
```

How it works:

- The server speaks Minecraft's standard **Server List Ping** over TCP, the same thing the multiplayer screen does. That one request provides availability, version and player counts, so **UDP Query and RCON are not used**.
- Browsers never contact the Minecraft server. They call `/api/status`.
- Results are cached in memory and concurrent requests share one probe, so the Minecraft server is contacted **at most once per cache window** however much traffic the site gets.
- Only the fields above are published. Player names, the MOTD, the favicon and anything else in the response are discarded.
- `state` is one of:
  - `online`: the server answered.
  - `offline`: the connection was refused, meaning nothing is listening on the port.
  - `unavailable`: timeout, DNS failure or an unreadable answer. The site shows a neutral "Status unavailable" rather than guessing.
  - `disabled`: `STATUS_ENABLED=false`.

`GET /healthz` returns `ok` and never touches Minecraft, so a stopped game server does not mark the website unhealthy.

## Deployment

The site runs as one small container (about 70 MB of memory, idle CPU near zero) behind the existing Apache reverse proxy.

```
Visitor -> Cloudflare -> Apache :443 (cherrycreek.app) -> 127.0.0.1:18082 -> container :4321
                                                                                |
                                         status check (TCP 25565) --------------+--> Minecraft
```

### 1. DNS (Cloudflare)

- `cherrycreek.app` (and `www` if wanted): **proxied**, pointing at the VPS.
- `play.cherrycreek.app`: leave **DNS only**. Minecraft traffic cannot pass through Cloudflare's HTTP proxy.
- `map.cherrycreek.app`: unchanged.

### 2. Container (Coolify)

1. New resource from this repository, build pack **Dockerfile** (or **Docker Compose** using `docker-compose.yaml`).
2. With the Dockerfile build pack, set the port mapping to `127.0.0.1:18082:4321` so the container is reachable only from the host. `docker-compose.yaml` already does this. Use any free loopback port and keep the Apache config in step.
3. Do not attach a public domain in Coolify if Apache fronts the site; Apache does the routing.
4. Add environment variables only where you want to override a default. Mark any `PUBLIC_*` or `SITE_URL` override as a build variable.
5. Health check: path `/healthz`, port `4321`. The image also defines its own `HEALTHCHECK`.

Without Coolify:

```bash
docker compose up -d --build
curl -s http://127.0.0.1:18082/healthz      # ok
curl -s http://127.0.0.1:18082/api/status
```

The container runs as the unprivileged `node` user and writes nothing to disk; the compose file additionally makes the filesystem read-only and drops all capabilities.

### 3. Reaching Minecraft from the container

Inside a container, `localhost` is the container itself, not the VPS. Two options:

- **Default, no setup:** leave `MC_STATUS_HOST` empty. The site connects to `play.cherrycreek.app:25565`, the same public address players use, which is already open.
- **Stay on the host:** set `MC_STATUS_HOST=host.docker.internal` (the compose file maps it to the Docker host). Minecraft must listen on an address the Docker bridge can reach, and UFW must allow that bridge subnet to port 25565. Check first with `sudo ufw status` and `docker network inspect <network>`. If the firewall _rejects_ the connection, the site will report "Offline"; if it silently _drops_ it, "Status unavailable".

Either way the handshake carries `PUBLIC_SERVER_ADDRESS`, exactly as a player's client would.

### 4. Apache

`deploy/apache-cherrycreek.app.conf.example` is a complete virtual host: HTTPS with the Cloudflare Origin CA certificate, reverse proxy to the container, long-lived caching for fingerprinted assets, and security headers including a Content Security Policy. The file's header lists the commands; `apache2ctl configtest` is read-only, and `systemctl reload apache2` applies the change without dropping other sites.

It adds a new vhost only. It does not modify the BlueMap vhost, the Minecraft server or any other site.

### 5. Verify

```bash
curl -sI https://cherrycreek.app | head -n 1       # HTTP/2 200
curl -s  https://cherrycreek.app/healthz           # ok
curl -s  https://cherrycreek.app/api/status        # JSON, state "online"
```

### Running without Docker

```bash
npm ci && npm run build
HOST=127.0.0.1 PORT=18082 node dist/server/entry.mjs
```

`dist/` is self-contained: server dependencies are bundled in, so no `node_modules` is needed at run time.

## Before going live

- [ ] Confirm the Discord invite in `PUBLIC_DISCORD_URL` is permanent (set to never expire).
- [ ] Add real screenshots (optional; the illustrations are fine until then).
- [ ] Add the community rules to `src/config/rules.ts` when they are ready.
- [ ] Read `src/pages/privacy.astro` against how the server is really configured, in particular Apache and Cloudflare logging.
- [ ] Check the commands table in `src/pages/guide.astro` against the server's plugin configuration.

## Accessibility and performance notes

- Semantic landmarks, a skip link, visible focus rings, and a keyboard-operable menu (Escape closes it).
- Copy buttons confirm visually and through a polite live region.
- Glass surfaces fall back to a near-opaque background where `backdrop-filter` is unsupported.
- `prefers-reduced-motion` removes the petals, reveals and transitions.
- Pages work without JavaScript; only the live status and copy buttons need it.

## Licence

MIT. See `LICENSE`.

Cherry Creek is an independent community project. It is not affiliated with or endorsed by Mojang or Microsoft.
