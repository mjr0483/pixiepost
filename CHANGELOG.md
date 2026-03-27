# PixiePost Changelog

## Guidelines
- Every meaningful change gets a log entry
- Format: `[DATE] [AUTHOR] [TYPE] Description`
- AUTHOR: Codex, Claude, or Joe
- TYPE: feat, fix, refactor, config, docs, infra
- When this file exceeds 500 lines, archive it to `/docs/changelog-archive/YYYY-MM.md` and start fresh

---

## 2026-03-26
- [2026-03-26] [Joe] [infra] Forked postiz-app to pixiepost repo
- [2026-03-26] [Joe] [infra] Deployed Coolify on Hetzner CPX31, Ashburn VA
- [2026-03-26] [Joe] [infra] pixiepost.pixiewire.com live with SSL
- [2026-03-26] [Codex] [docs] Initial README, CONTRIBUTING, and CHANGELOG setup
- [2026-03-26] [Codex] [infra] Added production Docker Compose and .env example for Coolify deployment
- [2026-03-26] [Codex] [docs] Added branch safety rules to Windsurf and Claude context files
- [2026-03-26] [Codex] [infra] Removed duplicate docker-compose.yaml so docker-compose.yml is the only production compose file
- [2026-03-26] [Codex] [infra] Added docker-compose.dev.yml for dev.pixiepost.pixiewire.com routing
- [2026-03-26] [Codex] [infra] Removed duplicate docker-compose.dev.yaml and pointed dev:docker at docker-compose.dev.yml
