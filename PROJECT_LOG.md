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

**Deploy requirement:** `ANTHROPIC_API_KEY` must be set in Coolify env vars.

---

## 2026-03-30 - Temporal & Elasticsearch Findings

**Elasticsearch is required.** Postiz registers >3 text search attributes with Temporal on startup. Postgres visibility store caps at 3. Without ES the backend crashes with `INVALID_ARGUMENT: Unable to create search attributes`.

**ES memory reduced:** `ES_JAVA_OPTS` from `-Xms256m -Xmx256m` to `-Xms128m -Xmx128m`.

**Temporal healthcheck fix:** The auto-setup image binds to the container's assigned IP (not localhost/0.0.0.0). `localhost` resolves to `::1` (IPv6) which doesn't match. Fixed healthcheck to use `$(hostname -i | cut -d' ' -f1):7233` to resolve the actual container IP dynamically. Deploy time dropped from 10+ minutes to ~1 minute.

**Server photos direct-add:** When creating a post and importing from Server Photos, photos now go directly into the post. No My Media detour.

---

## 2026-03-31 - Alt Text Auto-Generation (Claude Vision)

**Feature:** Every image attached to a post gets Claude Vision-generated alt text automatically.

**Three ways alt text gets set:**
1. **Agent draft** - When the Postiz agent creates a draft, the MCP tool calls Claude Vision on each image URL with the post text as context. Alt text saved to Media record immediately.
2. **"Alt Text AI" toolbar button** - Bulk generates alt text for all attached images using the post body for context. One click, all images done.
3. **"AI Generate" gear icon button** - Per-image generation in Media Settings popup.
4. **Auto at publish time** - If any image still has no alt text at publish, Claude Vision generates it as a fallback.

**Alt text is context-aware:** The post text is passed to Claude Vision so alt text references the subject matter (e.g., "Disney's Animal Kingdom Lodge lobby" instead of "grand hotel lobby").

**Provider support for alt text:**

| Provider | Alt text support | Implementation |
|----------|-----------------|----------------|
| Facebook | YES | `alt_text_custom` parameter on photo upload |
| Instagram | YES | `alt_text` parameter on media creation (added March 2025) |
| X/Twitter | YES | `createMediaMetadata()` after upload |
| Bluesky | YES | Already supported upstream |
| Mastodon | YES | `description` field in media upload FormData |
| Slack | YES | `alt_text` in image block |
| LinkedIn | NO | API doesn't support alt text on images |
| Threads | NO | API doesn't support alt text |

**Files changed:**

| File | What |
|------|------|
| `openai.service.ts` | Added `generateAltText(imageUrl, postContext?)` using Claude Vision |
| `media.controller.ts` | Added `POST /media/generate-alt-text` endpoint |
| `media.service.ts` | Added `generateAltTextForMedia()` method |
| `media.repository.ts` | Added `updateAltByPath()`, `findMediaByPath()` |
| `posts.service.ts` | Auto-generate alt at publish + persist agent alt at draft creation |
| `integration.schedule.post.ts` | MCP tool calls Claude Vision per-image instead of agent guessing |
| `media.settings.component.tsx` | Added "AI Generate" button in Media Settings |
| `media.component.tsx` | Added "Alt Text AI" bulk button in toolbar |
| `x.provider.ts` | Added `createMediaMetadata()` call after upload |
| `mastodon.provider.ts` | Added `description` to upload FormData |
| `facebook.provider.ts` | Added `alt_text_custom` to photo upload, URL-encoded spaces |
| `instagram.provider.ts` | Added `alt_text` to media creation |
| `slack.provider.ts` | Uses `m.alt` instead of hardcoded empty string |

**Key bug fixes during development:**
- MCP tool schema had `z.array(z.string())` for attachments - no field for alt text. Changed to `z.array(z.object({url, alt}))`.
- Agent generated fake media IDs (e.g., `P6dh2apjwe`) that don't exist in the Media table. Fixed by matching on file path instead.
- Facebook API rejected `/server-photos/` URLs with spaces. Fixed with `encodeURIComponent()`.
- Alt text from first post was being overwritten by subsequent posts. Fixed: only write alt if Media record has none.
- ImageMagick 6.x can't handle newer iPhone HEIC metadata. Switched photo processor to Python/Pillow (`pillow-heif`).

---

## 2026-03-31 - Photo Processor Rewrite

Switched from ImageMagick `convert` to Python/Pillow for HEIC support. iPhone 15+ HEIC files have metadata that ImageMagick 6.x can't parse (`Invalid input: Metadata not correctly assigned to image`).

**Files on server:**
- `/opt/pw-scripts/convert-image.py` - Pillow-based converter (HEIC/JPG/PNG/WebP -> JPEG, with optional resize + center crop)
- `/opt/pw-scripts/process-photos.sh` - Updated to call `convert-image.py` instead of `convert`, only scans `Originals/` subfolder
- `/opt/pw-scripts/fix-photo-perms.sh` - Cron every 5 min, sets 755/644 so nginx can serve

**Dependencies added:** `pillow`, `pillow-heif` (via pip3)

---

## Next Session Agenda

**Features to build:**
1. Auto-purge media from My Media after successful publish
2. Bulk delete in My Media (checkboxes + "Delete Selected")
3. Platform-aware subfolder auto-selection in Server Photos (show IG sizes for IG posts)

**Investigate:**
- Connect Postiz MCP to Claude Code for posting from chat
- Test Claude AI agent post quality and refine prompt template
- Consider deduplication guard: prevent creating multiple Media records for the same server photo path
