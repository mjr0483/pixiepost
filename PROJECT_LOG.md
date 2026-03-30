# PixiePost Fork - Project Log

This log tracks all fork-specific changes, decisions, and features added to PixiePost on top of upstream Postiz.

Upstream: https://github.com/gitroomhq/postiz-app
Fork: https://github.com/mjr0483/pixiepost

---

## Architecture

- **Monorepo** (PNPM): `apps/backend` (NestJS), `apps/frontend` (Vite React), `apps/orchestrator` (Temporal)
- **Build**: `Dockerfile.dev` in repo root (Node 22, nginx, pnpm, pm2)
- **Deploy**: Coolify on Hetzner CPX31 - must build from fork, not upstream image
- **URL**: https://pixiepost.pixiewire.com

## Fork-Specific Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| `DISABLE_REGISTRATION` | `true` | Single-user instance |
| `STORAGE_PROVIDER` | `local` | Files in `/uploads` Docker volume |
| `SERVER_PHOTOS_DIR` | `/server-photos` | Read-only mount of `/opt/pw-photos` |
| Image source | Build from fork | NOT `ghcr.io/gitroomhq/postiz-app:latest` |

## Upstream Sync

```bash
git remote add upstream https://github.com/gitroomhq/postiz-app.git  # once
git fetch upstream
git merge upstream/main
```

Fork-specific files to watch during merges:
- `var/docker/nginx.conf` (added `/server-photos/` block)
- `apps/backend/src/api/routes/media.controller.ts` (added server-browse/files/import endpoints)
- `libraries/nestjs-libraries/src/database/prisma/media/media.service.ts` (added server photos methods)
- `apps/frontend/src/components/media/media.component.tsx` (added tab system + ServerPhotosView)
- `apps/frontend/src/components/media/use-server-photos.ts` (new file, no conflict risk)
- `docker-compose.yml` (added server-photos volume + env var)

---

## Change Log

### 2026-03-29 - Initial Fork Setup

- Forked from gitroomhq/postiz-app
- Disabled registration
- Deployed to Hetzner via Coolify using upstream Docker image
- Configured Temporal healthchecks
- Fixed Coolify dynamicconfig mount path
- Updated Traefik entrypoint in docker-compose

### 2026-03-29 - Server Photos Browser

**Problem:** Media uploads only supported local PC file picker. All processed photos live on the server at `/opt/pw-photos/Social Media to be published/<shoot>/{X,IG 3x4,IG 4x5}/`. To use them in PixiePost, had to download and re-upload.

**Solution:** Added "Server Photos" tab to the media library that browses the server SSD and imports selected photos.

**Files changed:**

| File | What |
|------|------|
| `var/docker/nginx.conf` | `/server-photos/` static location block |
| `media.controller.ts` | `GET /server-browse`, `GET /server-files`, `POST /server-import` |
| `media.service.ts` | Folder listing, file listing (paginated), copy-to-uploads import |
| `media.component.tsx` | Tab system (My Media / Server Photos), `ServerPhotosView` component |
| `use-server-photos.ts` | SWR hooks for server photo API (one per endpoint) |
| `docker-compose.yml` | `/opt/pw-photos:/server-photos:ro` volume, `SERVER_PHOTOS_DIR` env |

**How it works:**
1. Open media picker -> "Server Photos" tab
2. Select shoot folder from dropdown (e.g. "Disney Animal Kingdom Lodge")
3. Pick size: X, IG 3x4, IG 4x5, or Originals
4. Browse photo grid (paginated, 18 per page)
5. Select photos (purple border + number badge, same UX as My Media)
6. "Import to Media Library" -> copies to `/uploads/`, creates DB records
7. Auto-switches to "My Media" tab with imported photos selected

**Security:**
- Server mount is read-only (`:ro`)
- All 3 endpoints go through `GetOrgFromRequest()` auth
- Path traversal blocked via `basename()` sanitization
- Import copies files, never modifies source photos
- Only `/server-photos/` prefix allowed for import

**Deploy requirement:** Coolify must build from fork (`Dockerfile.dev`) instead of pulling upstream image. Volume mount and env var must be added to Coolify compose.

---

## 2026-03-30 - Postiz Behavior Notes

**Media lifecycle (tested):**
- Publishing uploads media to the social platform. Postiz keeps its local copy in My Media but doesn't need it after publishing.
- Deleting a photo from My Media after publishing does NOT break the calendar view - the calendar shows the platform's hosted image.
- Republishing a post works even after deleting its media from My Media.
- Deleting a post from the calendar does NOT unpublish it from the platform. Must unpublish on the platform dashboard directly.

**Preview page fix:**
- `BACKEND_INTERNAL_URL` was set to `http://postiz:5000` (nginx) which routed `/public/posts/` to the Next.js frontend instead of the NestJS backend. Fixed to `http://localhost:3000` (backend direct).

**Server photos permission fix:**
- GoodSync syncs directories with `770` permissions. Nginx runs as `www` user and couldn't traverse them. Fixed with a cron job (`fix-photo-perms.sh`) that sets directories to `755` every 5 minutes.

**Completed improvements:**
- Direct-reference import - server photos no longer copied to /uploads/, URL points to /server-photos/ directly

**Planned improvements:**
- Auto-purge media from My Media after successful publish
- Bulk delete in My Media
- Platform-aware subfolder auto-selection in Server Photos
- Claude Vision for auto-generating captions and alt text from photos

---

## 2026-03-30 - Infrastructure Overhaul

**GitHub Actions CI pipeline:**
- Docker images now build on GitHub Actions, not on the server
- Image pushed to `ghcr.io/mjr0483/pixiepost:latest`
- Coolify pulls prebuilt image instead of building (was OOM-killing the server)
- Workflow: `.github/workflows/build-fork.yml`

**Temporal stability fix:**
- Healthcheck: `start_period` 30s -> 120s, retries 10 -> 20
- Postiz depends on `service_healthy` (backend crashes without Temporal)
- 2GB swap file added to prevent OOM during builds

**SFTP fix:**
- Security audit disabled password auth globally
- Added `PasswordAuthentication yes` in the `Match User pwsync` block
- GoodSync SFTP works again

**Login gate for dashboard and log:**
- Replaced Traefik basicAuth with HTML login form
- SHA-256 password validation, sessionStorage persistence
- 1Password can now autofill (was impossible with browser auth popup)
- Traefik still enforces HTTPS + security headers

---

## 2026-03-30 - Claude/Anthropic AI Swap

Replaced all OpenAI text AI with Claude (claude-sonnet-4-20250514). DALL-E kept for image generation.

**Files changed:**
- `openai.service.ts` - Anthropic SDK for all 7 text methods, OpenAI only for `generateImage()`
- `agent.graph.service.ts` - `ChatOpenAI` -> `ChatAnthropic` (@langchain/anthropic)
- `agent.graph.insert.service.ts` - `ChatOpenAI` -> `ChatAnthropic`
- `autopost.service.ts` - `ChatOpenAI` -> `ChatAnthropic`
- `load.tools.service.ts` - `@ai-sdk/openai` -> `@ai-sdk/anthropic`
- `copilot.controller.ts` - Uses Anthropic's OpenAI-compatible endpoint via CopilotKit

**New packages:** `@anthropic-ai/sdk`, `@langchain/anthropic`, `@ai-sdk/anthropic`
**New env var:** `ANTHROPIC_API_KEY` (set in Coolify)
**OPENAI_API_KEY:** Optional, only needed for DALL-E image generation

**Deploy requirement:** Both `ANTHROPIC_API_KEY` must be set in Coolify env vars.
