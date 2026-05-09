# SuperBrain — Operations Manual

**Live site:** [superbrain.social](https://superbrain.social)  
**Contact:** hello@superbrain.social  
**Stack:** Next.js · Supabase · PostHog · Vercel · Namecheap

---

## What Is SuperBrain?

SuperBrain is a browser-based cognitive testing platform. Users take short tests that measure reaction speed, memory, decision-making, and other cognitive traits. They receive a scored result with a title ("Elite Reactor", "Tactical Thinker"), can save it to a leaderboard, and challenge friends via a share link.

---

## Platform Overview

| Platform | What It Does | Where To Log In |
|---|---|---|
| **Vercel** | Hosts the website — runs the code live on the internet | [vercel.com](https://vercel.com) |
| **Supabase** | Database — stores user accounts, test scores, leaderboard, feedback | [supabase.com](https://supabase.com) |
| **PostHog** | Analytics — records which pages people visit and which events happen | [posthog.com](https://posthog.com) |
| **GitHub** | Code storage — every change to the app is saved here | [github.com](https://github.com) |
| **Namecheap** | Domain registrar — owns superbrain.social and controls DNS routing | [namecheap.com](https://namecheap.com) |

---

## Architecture in Plain English

```
User opens superbrain.social
        ↓
Vercel serves the Next.js app (the website code)
        ↓
User takes a test → score calculated in their browser (no server needed)
        ↓
User signs in / saves result → Supabase stores the score
        ↓
User shares link → Supabase retrieves it for the friend
        ↓
PostHog records what the user did (anonymised)
```

### Where Data Lives

| Data | Location |
|---|---|
| User accounts & passwords | Supabase → Authentication |
| Test scores & results | Supabase → Table: `test_results` |
| User profiles (display name, country) | Supabase → Table: `user_profiles` |
| In-app feedback survey responses | Supabase → Table: `test_feedback` |
| Page views, clicks, funnel events | PostHog |
| Session recordings | PostHog (if session replay is on) |
| Website code | GitHub → main branch |
| Live deployed website | Vercel |

---

## Quick Reference — Most Common Tasks

| Task | Where to go |
|---|---|
| Make a code change & go live | Edit code → push to GitHub → Vercel auto-deploys |
| View feedback from users | superbrain.social/admin/feedback (log in as admin first) |
| View analytics & funnels | PostHog dashboard |
| Add a new environment variable | Vercel → Project → Settings → Environment Variables |
| Run a SQL query | Supabase → SQL Editor |
| Roll back a broken deployment | Vercel → Deployments → pick older one → Redeploy |
| Restart local dev server | Press `Ctrl+C` in terminal, then `npm run dev` |

---

## Documentation Index

| Doc | Contents |
|---|---|
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Running the app on your own computer |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub, Vercel, and going live |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Database — tables, SQL, backups |
| [docs/POSTHOG.md](docs/POSTHOG.md) | Analytics and session replay |
| [docs/DOMAIN_SETUP.md](docs/DOMAIN_SETUP.md) | superbrain.social DNS and email |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Fixing common problems |

---

## Environment Variables Summary

These are secret configuration values the app needs. They live in two places:
- **Local development:** a file called `.env.local` in the project root
- **Production:** Vercel → Project Settings → Environment Variables

| Variable | What It Is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public API key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog server (`https://us.i.posthog.com`) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Your email — unlocks `/admin/feedback` |

> ⚠️ **Never share these values publicly or commit `.env.local` to GitHub.**

---

## Key URLs

| Purpose | URL |
|---|---|
| Live site | https://superbrain.social |
| Admin feedback | https://superbrain.social/admin/feedback |
| Leaderboard | https://superbrain.social/leaderboard |
| Privacy policy | https://superbrain.social/privacy |
| Contact page | https://superbrain.social/contact |
| Local dev | http://localhost:3000 |
