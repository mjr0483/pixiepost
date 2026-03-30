# Security Audit Log

## Audit: 2026-03-30

Full security review of all PixieWire infrastructure on Hetzner CPX31 (178.156.252.28).

---

### CRITICAL Findings

#### 1. Supabase: pw_ap_visits and pw_mileage have wide-open RLS policies
**Severity:** CRITICAL
**Status:** FIXED (2026-03-30)

Both tables previously allowed anon role full access. Fixed by:
1. Created Supabase Auth user (`log@pixiewire.com`) via signup API
2. Dropped all 8 anon RLS policies on `pw_ap_visits` and `pw_mileage`
3. Created 8 new policies restricted to `authenticated` role only
4. Patched pw-log app to auto-sign-in on page load
5. Signups re-disabled after user creation

The anon key in the HTML is now harmless - it can't read, write, or delete any data. Only the authenticated session token (obtained after sign-in) has access.

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
**Status:** FIXED (2026-03-30)

Two-layer firewall now in place:
1. **Hetzner Cloud Firewall** (`firewall-1`) - allows only TCP 22, 80, 443 and ICMP inbound. Blocks all other ports at the network level.
2. **DOCKER-USER iptables chain** - drops traffic to ports 5678, 6001, 6002, 8000, 8080, 8082, 8083 as defense-in-depth. Persists via `docker-firewall.service` systemd unit. Script at `/opt/pw-scripts/firewall-rules.sh`.

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
**Status:** FIXED (2026-03-30)

Added HTTPS-only entrypoint with HTTP->HTTPS redirect (301). Also added security headers middleware. HTTP requests to n8n.pixiewire.com now redirect to HTTPS.

#### 8. No security headers in Traefik
**Severity:** MEDIUM
**Status:** FIXED (2026-03-30)

Added security headers middleware to all three file-provider services (dashboard, log, n8n):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

#### 9. Dashboard and log basicAuth had low bcrypt cost
**Severity:** MEDIUM
**Status:** FIXED (2026-03-30)

Upgraded bcrypt cost from 5 to 10. Password rotated to 23-char strong password.

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
**Status:** FIXED (2026-03-30)

Was a 14-char secret (`pw-photos-7VHm`). Rotated to 48-char random hex. Webhook validates path and returns 404 for wrong paths. Dashboard nginx proxy updated to match.

#### 14. CORS wildcard on webhook responses
**Severity:** MEDIUM
**Status:** FIXED (2026-03-30)

Was `Access-Control-Allow-Origin: *`. Now restricted to `https://dashboard.pixiewire.com`. Both POST and OPTIONS responses use the restricted origin.

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
| ~~1~~ | ~~Supabase wide-open RLS on pw_ tables~~ | ~~CRITICAL~~ | **FIXED** - auth required, anon blocked |
| ~~5~~ | ~~No firewall~~ | ~~HIGH~~ | **FIXED** - Hetzner cloud FW + DOCKER-USER chain |
| ~~7~~ | ~~n8n missing HTTPS-only entrypoint~~ | ~~MEDIUM~~ | **FIXED** - HTTPS redirect + entrypoint |
| ~~8~~ | ~~No Traefik security headers~~ | ~~MEDIUM~~ | **FIXED** - HSTS, XFO, XCTO on all services |
| ~~9~~ | ~~Shared basicAuth with low bcrypt cost~~ | ~~MEDIUM~~ | **FIXED** - bcrypt cost 10, new password |
| ~~11~~ | ~~Services on 0.0.0.0 bypass Traefik auth~~ | ~~MEDIUM~~ | **FIXED** - blocked by Hetzner FW + DOCKER-USER |
| ~~13~~ | ~~Weak webhook secret~~ | ~~MEDIUM~~ | **FIXED** - rotated to 48-char hex |
| ~~14~~ | ~~CORS wildcard on webhooks~~ | ~~MEDIUM~~ | **FIXED** - restricted to dashboard origin |
