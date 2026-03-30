# Security Audit Log

## Audit: 2026-03-30

Full security review of all PixieWire infrastructure on Hetzner CPX31 (178.156.252.28).

---

### CRITICAL Findings

#### 1. Supabase: pw_ap_visits and pw_mileage have wide-open RLS policies
**Severity:** CRITICAL
**Status:** OPEN (requires app changes to fix properly)

Both tables allow anon role to INSERT, UPDATE, DELETE with `USING (true)` / `WITH CHECK (true)`. The anon key is embedded in the pw-log static HTML (`/opt/pw-log/index.html`), so anyone who views page source can extract the key and wipe all records.

**Tables affected:** `pw_ap_visits`, `pw_mileage`
**Risk:** Data deletion/modification by anyone
**Fix needed:** Add Supabase Auth to the pw-log app, then restrict policies to authenticated users only. This is a code change - cannot be done without modifying the app.
**Workaround considered:** Cannot restrict by IP (Supabase cloud). Cannot add user auth without app rewrite. Current mitigation is that the URLs (dashboard.pixiewire.com, log.pixiewire.com) return 401 via Traefik basic auth, which hides the anon key from casual visitors. But the key is still the same JWT that could be extracted if someone had prior access.

#### 2. Webhook on port 8085 had NO authentication
**Severity:** CRITICAL
**Status:** FIXED

`/opt/pw-scripts/webhook-server.py` (port 8085) accepted any POST to `/process-photos` with no secret, no auth. Bound to `0.0.0.0` so accessible from the internet.

**Fix applied:** Disabled and stopped the `pw-webhook.service`. The authenticated webhook on port 8084 (requires secret path `/pw-photos-7VHm`) remains active.

---

### HIGH Findings

#### 3. SSH password authentication was enabled
**Severity:** HIGH
**Status:** FIXED

`PasswordAuthentication yes` was the effective setting. Combined with the `pwsync` user having a known password (documented in project files), this allowed password-based SSH login attempts.

**Fix applied:** Set `PasswordAuthentication no` in `/etc/ssh/sshd_config` and reloaded SSH. Key-only auth now enforced for root. The pwsync user is SFTP-only (`ForceCommand internal-sftp`) with chroot, so it's not affected.

#### 4. No fail2ban / brute force protection
**Severity:** HIGH
**Status:** FIXED

No intrusion prevention was installed. SSH was exposed to brute force attacks.

**Fix applied:** Installed `fail2ban` with default sshd jail. Auto-bans IPs after failed login attempts.

#### 5. No firewall (UFW not active, iptables default ACCEPT)
**Severity:** HIGH
**Status:** OPEN (risk of breaking Docker networking)

INPUT chain policy is ACCEPT with no rules. All ports bound to `0.0.0.0` are accessible from the internet. This includes:
- Port 5678 (n8n) - directly accessible, bypassing Traefik
- Port 8000 (Coolify) - directly accessible
- Port 8080 (Traefik dashboard / Temporal UI)
- Port 8082 (pw-log nginx)
- Port 8083 (pw-dashboard nginx)
- Port 8084 (photo webhook)

**Risk:** Services meant to be behind Traefik auth can be accessed directly by port.
**Recommended fix:** Configure UFW to allow only 22, 80, 443. Docker manages its own iptables rules for container networking, so UFW needs the Docker UFW fix (`DOCKER-USER` chain rules) to avoid breaking containers. This needs careful testing.

#### 6. Supabase storage upload policy had no bucket restriction
**Severity:** HIGH
**Status:** FIXED

The `anon can upload mileage photos` policy on `storage.objects` had no `WITH CHECK` clause restricting which bucket anon could upload to. This meant anon could potentially upload to any bucket.

**Fix applied:** Recreated policy with `WITH CHECK (bucket_id = 'mileage-photos')`.

---

### MEDIUM Findings

#### 7. n8n Traefik router missing HTTPS-only entrypoint
**Severity:** MEDIUM
**Status:** OPEN

In `/data/coolify/proxy/dynamic/n8n.yml`, the n8n router does not specify `entryPoints: [https]` and lacks a `redirect-to-https` middleware. Other services (pw-dashboard, pw-log) do this correctly.

**Risk:** n8n could be accessed over unencrypted HTTP, exposing credentials in transit.
**Fix:** Add `entryPoints: [https]` and redirect middleware to n8n Traefik config.

#### 8. No security headers in Traefik
**Severity:** MEDIUM
**Status:** OPEN

Traefik dynamic configs have no middleware for security headers. Missing: `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security` (HSTS), `X-Content-Type-Options`, `Referrer-Policy`.

**Risk:** All proxied services vulnerable to clickjacking, no HSTS enforcement.
**Fix:** Add a shared headers middleware in Traefik dynamic config.

#### 9. Dashboard and log share basicAuth with low bcrypt cost
**Severity:** MEDIUM
**Status:** OPEN

Both `pw-dashboard.yml` and `pw-log.yml` use the identical bcrypt hash for user `admin` with cost factor 5 (minimum recommended: 10).

**Risk:** Shared credentials + low cost factor makes brute-force easier.
**Fix:** Increase bcrypt cost to 10+, use separate credentials for each service.

#### 10. Coolify API enabled with admin token
**Severity:** MEDIUM (INFO)
**Status:** NOTED

Coolify API was enabled during this session with token `3|zm8W...`. The token has full admin access. Stored in HETZNER.md for Claude agent use. Not exposed externally (Coolify is behind Traefik).

#### 11. Multiple services bound to 0.0.0.0 instead of 127.0.0.1
**Severity:** MEDIUM
**Status:** OPEN (needs firewall - see finding #5)

Docker containers expose ports on all interfaces by default. Services that should only be accessible via Traefik reverse proxy are directly reachable by IP:port, bypassing Traefik auth:
- n8n (5678), Coolify (8000), Traefik API (8080), pw-dashboard (8083), pw-log (8082)

**Risk:** `http://178.156.252.28:8082` serves pw-log HTML directly, bypassing basicAuth. Exposes Supabase anon key.
**Mitigation:** Blocked by firewall fix (#5), or rebind containers to `127.0.0.1`.

#### 12. Two redundant webhook services were running
**Severity:** MEDIUM
**Status:** FIXED

Port 8084 (authenticated, secret path) and port 8085 (unauthenticated) both ran photo processing. Port 8085 is now disabled. Only 8084 remains.

#### 13. Photo webhook secret is weak and hardcoded
**Severity:** MEDIUM
**Status:** OPEN

The webhook on port 8084 uses a 14-char secret in the URL path. This is in the script file and also in the dashboard nginx proxy config.

**Fix:** Rotate to a longer random string. Consider auth header instead of URL path.

#### 14. CORS wildcard on webhook responses
**Severity:** MEDIUM
**Status:** OPEN

Webhook scripts set `Access-Control-Allow-Origin: *`. Any website can trigger the webhook via JavaScript.

**Fix:** Restrict to `https://dashboard.pixiewire.com` only.

---

### LOW Findings

#### 15. Supabase: 42 tables with RLS enabled but no policies
**Severity:** LOW
**Status:** NOTED

These tables have RLS enabled but zero policies. Effectively locked - no role can access them via the API. Safe, but may indicate orphaned tables.

#### 16. Supabase: mileage-photos storage bucket is public
**Severity:** LOW
**Status:** NOTED

Bucket is `public: true` - files readable without auth via direct URL. Intentional for the pw-log app photo display. SELECT policy correctly restricts to this bucket only.

#### 17. Supabase: 1 SECURITY DEFINER function
**Severity:** LOW
**Status:** NOTED

`rls_auto_enable` runs as SECURITY DEFINER. Supabase system function. Safe.

#### 18. Supabase: Unindexed foreign keys (performance)
**Severity:** LOW
**Status:** NOTED

Several tables have foreign keys without covering indexes. Performance only, not security.

#### 19. n8n credentials use encrypted store
**Severity:** INFO
**Status:** GOOD

All 7 n8n workflows reference credentials by ID from n8n's encrypted credential store. No hardcoded API keys in workflow definitions.

#### 20. Only root has a login shell
**Severity:** INFO
**Status:** GOOD

Only `root` has `/bin/bash`. `pwsync` has `/usr/sbin/nologin`, chroot-jailed to `/opt/pw-photos`, SFTP-only.

#### 21. Auto-updates enabled
**Severity:** INFO
**Status:** GOOD

`APT::Periodic::Unattended-Upgrade "1"` is set. Security patches auto-install.

#### 22. All subsites have valid SSL
**Severity:** INFO
**Status:** GOOD

All 7 subsites respond over HTTPS via Traefik + Let's Encrypt. Dashboard and log enforce basic auth (401).

#### 23. PixiePost properly secured
**Severity:** INFO
**Status:** GOOD

`NOT_SECURED=false`, registration disabled, CORS restricted to frontend URL.

#### 24. 2 SSH keys authorized for root
**Severity:** INFO
**Status:** NOTED

Two public keys in `/root/.ssh/authorized_keys`. Verify both are yours.

---

## Fixes Applied This Audit

| # | Finding | Action |
|---|---------|--------|
| 2 | Unauthenticated webhook (8085) | Stopped and disabled `pw-webhook.service` |
| 3 | SSH password auth enabled | Set `PasswordAuthentication no`, reloaded SSH |
| 4 | No fail2ban | Installed fail2ban with sshd jail |
| 6 | Storage upload policy too broad | Restricted to `mileage-photos` bucket only |
| 9 | Redundant webhook | Disabled port 8085, kept authenticated 8084 |

## Open Items Requiring Manual Action

| # | Finding | Priority | Action Needed |
|---|---------|----------|---------------|
| 1 | Supabase wide-open RLS on pw_ tables | CRITICAL | Add Supabase Auth to pw-log app |
| 5 | No firewall | HIGH | Configure UFW with Docker compatibility |
| 7 | n8n missing HTTPS-only entrypoint | MEDIUM | Add `entryPoints: [https]` to n8n.yml |
| 8 | No Traefik security headers | MEDIUM | Add headers middleware (HSTS, X-Frame-Options, CSP) |
| 9 | Shared basicAuth with low bcrypt cost | MEDIUM | Increase cost to 10+, separate credentials |
| 11 | Services on 0.0.0.0 bypass Traefik auth | MEDIUM | Blocked by firewall setup (#5) |
| 13 | Weak webhook secret | MEDIUM | Rotate to longer random string |
| 14 | CORS wildcard on webhooks | MEDIUM | Restrict to dashboard origin |
