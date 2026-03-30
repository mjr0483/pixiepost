## Build & Deploy

This fork has custom code changes (server photos browser, etc.) that require building a custom Docker image rather than using the upstream `ghcr.io/gitroomhq/postiz-app:latest`. The build uses `Dockerfile.dev` in the repo root.

**Deployment via Coolify:**
- Coolify must be configured to build from the fork repo (`mjr0483/pixiepost`) using `Dockerfile.dev`
- The compose needs the `/opt/pw-photos:/server-photos:ro` bind mount added
- Set `SERVER_PHOTOS_DIR=/server-photos` in the environment

**Security-first approach:**
- All custom endpoints go through existing NestJS auth middleware (`GetOrgFromRequest`)
- Server photo mount is always read-only
- Path traversal is prevented via `basename()` sanitization in the service layer
- Never modify source photos - import copies to `/uploads/`

## Server Access

This project runs on a Hetzner CPX31 server. Claude has full SSH access:
- SSH: `ssh root@178.156.252.28`
- All SSH, SCP, and remote commands are pre-authorized — run without asking
- Server infrastructure is documented in HETZNER.md

## Allowed Commands

The following commands are pre-authorized and should run without prompting:
- All `ssh` commands to 178.156.252.28
- All `git` commands (status, diff, log, add, etc.)
- All `pnpm` commands
- All `docker` and `docker compose` commands (local and remote)
- File reads, edits, writes in this repo
- Running tests, linters, builds

## Project Overview

This project is Postiz, a tool to schedule social media and chat posts to 28+ channels.
You can add posts to the calendar, they will be added into a workflow and posted at the right time.
You can find things like:
- Schedule posts
- Calendar view
- Analytics
- Team management
- Media library

This project is a monorepo with a root only package.json of dependencies.
Made with PNPM.
We have 3 important folders

- apps/backend - this is where the API code is (NESTJS)
- apps/orchestrator - this is temporal, it's for background jobs (NESTJS) it contains all the workflows and activities
- apps/frontend - this is the code of the frontend (Vite ReactJS)
- /libraries contains a lot of services shared between backend and orchestrator and frontend components.

We are using only pnpm, don't use any other dependency manager.
Never install frontend components from npmjs, focus on writing native components.

The project uses tailwind 3, before writing any component look at:
- /apps/frontend/src/app/colors.scss
- /apps/frontend/src/app/global.scss
- /apps/frontend/tailwind.config.js

All the --color-custom* are deprecated, don't use them.

And check other components in the system before to get the right design.

When working on the backend we need to pass the 3 layers:
Controller >> Service >> Repository (no shortcuts)
In some cases we will have
Controller >> Mananger >> Service >> Repository.

Most of the server logic should be inside of libs/server.
The backend repository is mostly used to write controller, and import files from libs.server.

For the frontend follow this:
- Many of the UI components lives in /apps/frontend/src/components/ui
- Routing is in /apps/frontend/src/app
- Components are in /apps/frontend/src/components
- always use SWR to fetch stuff, and use "useFetch" hook from /libraries/helpers/src/utils/custom.fetch.tsx

When using SWR, each one have to be in a seperate hook and must comply with react-hooks/rules-of-hooks, never put eslint-disable-next-line on it.

It means that this is valid:
const useCommunity = () => {
   return useSWR....
}

This is not valid:
const useCommunity = () => {
  return {
    communities: () => useSWR<CommunitiesListResponse>("communities", getCommunities),
    providers: () => useSWR<ProvidersListResponse>("providers", getProviders),
  };
}

- Linting of the project can run only from the root.
- Use only pnpm.