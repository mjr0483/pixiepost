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
## 2026-03-27
- [2026-03-27] [Codex] [infra] Backed up docker-compose.yml and updated production compose credentials and Temporal networking
- [2026-03-27] [Codex] [infra] Removed duplicate docker-compose.yaml and kept docker-compose.yml as the production compose file
