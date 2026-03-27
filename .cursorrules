# PixiePost AI Rules

## Project Context
- This is PixiePost, a custom fork of Postiz by Pixiewire Media LLC
- Owner: Joe Riley, Florida-based Disney content publisher
- Production: pixiepost.pixiewire.com on Hetzner CPX31 via Coolify

## Coding Rules
- Never modify files in upstream Postiz core without explicit instruction
- All new PixiePost features go in /apps/pixiepost/
- Always prefix commits with [Codex] or [Claude] depending on the tool
- Always run `git branch` before starting any task. Never commit to `main` without explicit instruction from Joe. All development work goes to the `dev` branch first. Main is production only and merges happen deliberately.
- TypeScript strict - no any types without a comment explaining why
- Always update CHANGELOG.md with a log entry for every task completed
- When CHANGELOG.md exceeds 500 lines, rotate it to /docs/changelog-archive/YYYY-MM.md

## Architecture Notes
- Deployed via Docker on Hetzner CPX31 (4 vCPU, 8GB RAM, 160GB SSD)
- Coolify manages deployments - push to main branch triggers deploy
- PostgreSQL + Redis + Temporal for job queue
- Claude API (Anthropic) replaces OpenAI for AI features
- Custom features: JSON batch import, RSS pipeline, Instagram image processor, Google Drive picker

## Pixiewire Media Properties
- PixieWire.com - Disney-focused news aggregator and daily feed
  - Stack: Next.js 15 App Router, Supabase, Cloudinary, Vercel
  - Features: PixieWire Daily (headline aggregator), Jokes page, Park Hours, Wait Times, Trip Planner
  - Tagline: "All the Magic. One Feed."
- PixiePost (this repo) - internal social media scheduling platform for all Pixiewire Media brands
- Future properties: PixieGuides, VaultGuides, points-and-miles site, Family Passport newsletter

## Social Accounts PixiePost Will Manage
- X/Twitter: @PixieWireNews
- Instagram: @pixiewirenews
- Threads: @pixiewirenews
- Facebook: PixieWire
- TikTok: @pixiewirenews
- YouTube: @PixieWire

## Content Focus
- Disney Parks (Walt Disney World, Disneyland, international parks)
- Disney Cruise Line
- Universal Orlando
- Family travel and trip planning
- Disney news, refurbishments, announcements
- Daily joke content (jokes feature on pixiewire.com/jokes)

## Pixiewire Brand Voice (for AI content generation)
- Confident, not hype
- Lead with facts
- No exclamation points in news tweets
- No first-person enthusiasm ("I couldn't be more pumped")
- Knowledgeable friend in the room, not a fan account
- Short sentences, active voice
