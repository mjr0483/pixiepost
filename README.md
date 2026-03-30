# PixiePost by Pixiewire Media

Custom social media scheduling platform built on [Postiz](https://github.com/gitroomhq/postiz-app).

## What It Is

PixiePost is a fork of Postiz customized for Pixiewire Media's workflow, including Claude AI integration, JSON batch import, automated RSS pipeline, and Instagram image processing.

## Tech Stack

- Next.js / TypeScript (frontend via Vite + React)
- NestJS (backend API + Temporal orchestrator)
- PostgreSQL 17
- Redis 7.2
- Temporal (background job workflows)
- Docker / Docker Compose
- Hetzner CPX31
- Coolify (deployment)
- Traefik + Cloudflare DNS (reverse proxy)

## Production URL

https://pixiepost.pixiewire.com

## Docker Services

Production runs via `docker-compose.yml` managed by Coolify:

- `postiz` - Main PixiePost app (ghcr.io/gitroomhq/postiz-app)
- `postiz-postgres` - PostgreSQL 17 (app database)
- `postiz-redis` - Redis 7.2 (caching/queues)
- `spotlight` - Sentry Spotlight (error tracking)
- `temporal` - Temporal server (auto-setup)
- `temporal-postgresql` - PostgreSQL 16 (Temporal database)
- `temporal-elasticsearch` - Elasticsearch 7.17 (Temporal visibility)
- `temporal-admin-tools` - Temporal CLI tools
- `temporal-ui` - Temporal web UI

## Local Development

```bash
pnpm install
cp .env.example .env        # Edit with local values
docker compose -f docker-compose.dev.yaml up -d
pnpm dev
```

Dev compose includes pgAdmin and RedisInsight for database management.

## Upstream Sync

```bash
git fetch upstream
git merge upstream/main
```

## Project Docs

- `PROJECT_LOG.md` - Fork-specific changes, features, and decisions
- `HETZNER.md` - Server infrastructure and Coolify container map

## Upstream Repository

https://github.com/gitroomhq/postiz-app
