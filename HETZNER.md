# Hetzner Server Project Log

## Server Info

| | |
|---|---|
| Provider | Hetzner CPX31 |
| IP | 178.156.252.28 |
| OS | Ubuntu 24.04.4 LTS (kernel 6.8.0) |
| CPU | 4 vCPU |
| RAM | 7.6 GB |
| Disk | 150 GB SSD (18 GB used, 13%) |
| Access | SSH as root |
| Panel | Coolify 4.0.0-beta.470 |

## Docker Containers

### Coolify Platform

| Container | Image | Purpose |
|-----------|-------|---------|
| coolify | coollabsio/coolify:4.0.0-beta.470 | Self-hosted PaaS (port 8000) |
| coolify-proxy | traefik:v3.6 | Reverse proxy (80/443) |
| coolify-db | postgres:15-alpine | Coolify database |
| coolify-redis | redis:7-alpine | Coolify cache |
| coolify-realtime | coollabsio/coolify-realtime:1.0.11 | Coolify websockets (6001-6002) |
| coolify-sentinel | coollabsio/sentinel:0.0.21 | Coolify monitoring agent |

### PixiePost (Postiz Fork)

| Container | Image | Purpose |
|-----------|-------|---------|
| postiz | Built from mjr0483/pixiepost fork | Main app (port 5000) |
| postiz-postgres | postgres:17-alpine | App database |
| postiz-redis | redis:7.2 | App cache/queues |
| spotlight | getsentry/spotlight:latest | Sentry error tracking (8969) |
| temporal | temporalio/auto-setup:1.28.1 | Background job server |
| temporal-postgresql | postgres:16 | Temporal database |
| temporal-elasticsearch | elasticsearch:7.17.27 | Temporal search (9200) |
| temporal-admin-tools | temporalio/admin-tools:1.28.1 | Temporal CLI |
| temporal-ui | temporalio/ui:2.34.0 | Temporal web UI (8080) |

### Other Services

| Container | Image | Purpose | URL |
|-----------|-------|---------|-----|
| n8n | n8nio/n8n:latest | Workflow automation (5678) | n8n.pixiewire.com |
| umami | umami-software/umami:3.0.3 | Website analytics | umami.pixiewire.com |
| postgresql (umami) | postgres:16-alpine | Umami database | |
| uptime-kuma | louislam/uptime-kuma:2 | Uptime monitoring (3001) | status.pixiewire.com |
| serpbear | towfiqi/serpbear:latest | SEO rank tracking (3000) | serp.pixiewire.com |
| pw-dashboard | nginx:alpine | Pixiewire ops dashboard (8083) | dashboard.pixiewire.com |
| pw-log | nginx:alpine | AP & mileage tracker (8082) | log.pixiewire.com |

## Pixiewire Subsites & Apps

### dashboard.pixiewire.com (pw-dashboard)

Central ops hub. Single-page static site served by nginx (port 8083). Links to all services.

**Sections:**
- **PixieWire Site** - links to pixiewire.com and pixiewire.com/admin (CMS)
- **Quick Actions** - "Process Photos" button (calls `/api/process-photos` which proxies to port 8084 webhook)
- **Server Tools** - links to log, Umami, PixiePost, SerpBear, Uptime Kuma, Coolify, n8n
- **Vendor Dashboards** - Supabase, Vercel, Google Analytics, Google Search Console, Beehiiv
- **Socials** - X (@PixieWireNews), Instagram, Facebook, YouTube, TikTok

Files: `/opt/pw-dashboard/index.html`, `/opt/pw-dashboard/conf/default.conf`

Nginx also proxies `/api/process-photos` to the photo webhook on port 8084.

---

### log.pixiewire.com (pw-log)

AP & Mileage field logging app. Single-page Supabase-backed app served by nginx (port 8082).

**Two tabs:**

**AP Visits** - Logs Disney World Annual Pass visits for business expense tracking
- Fields: date, park/location, visit type, who attended (Joe/Mary/Megan), business purpose, content delivered, photos, notes
- Summary cards show total visits and business percentage
- Autocomplete on location names with custom location management
- Photo upload to Supabase storage
- Export to Google Sheets via n8n webhook (`/webhook/ap-visits-export`)
- Data stored in Supabase `pw_ap_visits` table

**Mileage** - Logs business mileage for IRS deduction
- Fields: date, origin, destination, miles, vehicle, business purpose, notes
- Configurable IRS rate (default $0.725/mile)
- Summary cards show total miles and deduction amount
- Export to Google Sheets via n8n webhook (`/webhook/mileage-export`)
- Data stored in Supabase `pw_mileage` table
- Gmail notification on each entry via n8n

Both tabs feature: bottom-sheet forms, record cards with edit/delete, lightbox for photos, toast notifications. Mobile-first PWA design (apple-mobile-web-app-capable).

Supabase project: `fjawkyijewhevyfcqpww`

Files: `/opt/pw-log/index.html`

---

### pixiepost.pixiewire.com (postiz)

PixiePost social media scheduler (Postiz fork). See README.md.

### n8n.pixiewire.com (n8n)

Workflow automation. See n8n Workflows section below.

### umami.pixiewire.com (umami)

Self-hosted website analytics. Postgres-backed. Tracks pixiewire.com traffic.

### status.pixiewire.com (uptime-kuma)

Uptime monitoring for all Pixiewire services.

### serp.pixiewire.com (serpbear)

SEO rank tracking for pixiewire.com keywords.

### coolify.pixiewire.com (coolify)

Self-hosted PaaS managing all Docker containers on this server.

---

## Non-Docker Services

### Photo Sync (SFTP + ImageMagick)

| | |
|---|---|
| SFTP User | `pwsync` (chrooted to `/opt/pw-photos`, SFTP-only) |
| Sync Tool | GoodSync on local PC over SFTP |
| Photo Root | `/opt/pw-photos/Social Media to be published/` |
| Scripts | `/opt/pw-scripts/` |
| Cron | `*/30 * * * *` runs `process-photos.sh` |
| Webhook | `pw-photo-webhook.service` (port 8084) |
| Webhook (alt) | `pw-webhook.service` (port 8085) |

**Folder structure per shoot:**
```
<Shoot Name>/
  Originals/    # Source photos (HEIC, JPG, WebP, PNG) synced from local PC
  X/            # Converted to JPG, original dimensions, quality 90
  IG 3x4/       # Resized 1080x1440, center crop, quality 85
  IG 4x5/       # Resized 1080x1350, center crop, quality 85
```

### n8n Workflows

**Credentials used:**
- Gmail OAuth2 (`JqQSe3Q6R1OwXjiC`) - sends email notifications
- Google Sheets OAuth2 (`lEdJ3ADpEJxX2gGg`) - appends mileage data
- Google Drive OAuth2 (`37yBn6a08BijDGC8`) - creates export spreadsheets

---

#### 1. Expense Notification (active)

Webhook receives expense form data, emails summary to joe@pixiewire.com.

```
POST /webhook/82b4482c-...
  -> Gmail: "New expense from {submitted_by} - {location}"
     Body: person, date, location, cost, business_pct, purpose, content_delivered, notes
```

No Google Drive dependency. Clean.

---

#### 2. Mileage Notification (active)

Webhook receives mileage entry, logs to Google Sheets AND sends email (parallel).

```
POST /webhook/d1700329-...
  -> Google Sheets: append row (Date, Type, Purpose, Vehicle, Origin, Dest, Distance, Deduction)
  -> Gmail: "Mileage logged - {submitted_by} - {origin} to {destination}"
     Calculates IRS deduction at $0.725/mile
```

Uses Google Sheets (not Drive). Still needed for mileage tracking.

---

#### 3. Mileage Export to Sheets (active)

On-demand export: queries Supabase `pw_mileage` table, creates a new Google Spreadsheet with results.

```
POST /webhook/mileage-export  (body: {date_from, date_to})
  -> HTTP GET: Supabase pw_mileage (date range filter)
  -> Code: map rows to spreadsheet format
  -> HTTP POST: Google Drive API - create new spreadsheet
     Parent folder: 196fa8CLzvkHpbeqGOK-0AW7zvCnciSFn
  -> HTTP POST: Google Sheets API - write rows
  -> Respond: {success, file_url, rows}
```

Uses Google Drive API to create the spreadsheet file. This is an export tool, not a sync dependency.

---

#### 4. AP Visits Export to Sheets (active)

Same pattern as #3 but for `pw_ap_visits` table.

```
POST /webhook/ap-visits-export  (body: {date_from, date_to})
  -> HTTP GET: Supabase pw_ap_visits (date range filter)
  -> Code: map rows (Date, Park, Visit Type, Who, Joe, Mary, Megan, Purpose, Content, Notes)
  -> HTTP POST: Google Drive API - create new spreadsheet
     Parent folder: 196fa8CLzvkHpbeqGOK-0AW7zvCnciSFn
  -> HTTP POST: Google Sheets API - write rows
  -> Respond: {success, file_url, rows}
```

Uses Google Drive API for export only.

---

#### 5. Setup: Create Folders Sequential (DEACTIVATED)

Creates Google Drive folder tree for old photo workflow. **No longer needed** since photos are on local SSD.

```
POST /webhook/setup-folders-seq
  -> Creates: Social Media Posts/
       _inbox/ -> IG/, X/
       ready/  -> IG/ (4x5/, 3x4/), X/
```

All 17 nodes are Google Drive API calls. **Should be deactivated.**

---

#### 6. PixieWire Photo Processor v1 (INACTIVE)

Old Google Drive-based photo processor. Watches a Drive folder, downloads, resizes with n8n editImage, uploads back.

```
Google Drive Trigger (watch folder 1EPHq7b...)
  -> Check parent not output folder
  -> Resolve subject folder
  -> List/create subfolders (X, IG 3x4, IG 4x5)
  -> Download original from Drive
  -> Resize IG 4x5 (1080x1350, cover, q85)
  -> Resize IG 3x4 (1080x1440, cover, q85)
  -> Convert to JPEG for X (original dims, q90)
  -> Upload all three back to Drive
  -> Gmail notification
```

16 nodes, entirely Google Drive dependent. Already inactive. **Can be deleted.**

---

#### 7. PixieWire Photo Processor v2 (DEACTIVATED)

**Still calls Google Drive API** despite the move to local SSD. Lists subject folders from Drive folder `1EPHq7b...`, then runs a Code node that tries to process via Drive API.

```
POST /webhook/process-photos  OR  Every 30 Minutes
  -> HTTP GET: Google Drive API - list folders in 1EPHq7b...
  -> Code: process all photos (Drive-based)
  -> Gmail: send summary
```

This is **not** calling the local `process-photos.sh` script. The dashboard webhook (port 8084) calls the bash script directly. This n8n workflow is a separate, redundant Drive-based processor. **Should be deactivated** -- the cron job + dashboard webhook handle everything locally now.

## File Locations

```
/opt/pw-photos/          # SFTP root, photo storage (27 MB)
/opt/pw-dashboard/       # Dashboard static site (28 KB)
/opt/pw-scripts/         # Photo processing scripts (24 KB)
/opt/pw-log/             # AP & mileage tracker site
/opt/postiz/             # PixiePost data
/opt/temporal/           # Temporal data
```

## Status Log

### 2026-03-29 - Initial Audit

- 21 containers running, all healthy
- Server at 13% disk, 68% RAM, load ~0.7
- Photo pipeline operational: GoodSync SFTP sync + local ImageMagick processing
- Two redundant webhook services running (8084 and 8085) - could consolidate
- Registration disabled on PixiePost

### 2026-03-29 - n8n Workflow Audit

Google Drive has been removed from the photo pipeline. Photos now sync via GoodSync SFTP to `/opt/pw-photos/` and are processed locally by ImageMagick (`process-photos.sh`).

**n8n workflows that still use Google Drive:**
- **#5 Setup: Create Folders Sequential** - entirely Drive-based folder creation. STALE. Should deactivate.
- **#6 Photo Processor v1** - already inactive. Can delete.
- **#7 Photo Processor v2** - still lists folders from Drive API and processes via Drive. STALE. The actual processing is now done by the cron job (`process-photos.sh`) and dashboard webhook (port 8084). Should deactivate.

**n8n workflows that are fine:**
- **#1 Expense Notification** - webhook + Gmail. No Drive dependency.
- **#2 Mileage Notification** - webhook + Google Sheets + Gmail. Sheets is still needed.
- **#3 Mileage Export** - Supabase query, creates a Google Spreadsheet for export. Uses Drive API only to create the export file (not for photo sync).
- **#4 AP Visits Export** - same pattern as #3. Export-only Drive usage.

**Completed:**
- [x] Deactivated n8n workflow #5 (Drive folder setup)
- [x] Deactivated n8n workflow #7 (Drive-based photo processor v2)
- [x] Updated dashboard "Process Photos" button text (was "Google Drive", now "on server")

**Remaining:**
- [ ] Delete n8n workflow #6 (old processor, already inactive)
- [ ] Consolidate webhook services (8084 vs 8085)

### 2026-03-29 - Server Photos Browser Feature

Added server photo browsing to PixiePost. The postiz container now needs:
- Volume mount: `/opt/pw-photos:/server-photos:ro`
- Env var: `SERVER_PHOTOS_DIR=/server-photos`
- **Build from fork** (`mjr0483/pixiepost` via `Dockerfile.dev`) instead of upstream image

See `PROJECT_LOG.md` for full code change details and security notes.
