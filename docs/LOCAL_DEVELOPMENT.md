# Local Development Guide

This guide explains how to run SuperBrain on your own computer for testing changes before they go live.

---

## Prerequisites — Do This Once

### Step 1 — Install Node.js

Node.js is the engine that runs the app on your computer.

1. Go to [nodejs.org](https://nodejs.org)
2. Click the **LTS** version (the green button — "Recommended For Most Users")
3. Download and run the installer
4. When it finishes, open Terminal and type:
   ```
   node --version
   ```
   You should see something like `v20.11.0`. If you do, Node is installed correctly.

### Step 2 — How to Open Terminal (Mac)

Terminal is the application you type commands into.

- Press **⌘ + Space**, type `Terminal`, press **Enter**
- Or: open Finder → Applications → Utilities → Terminal

> 💡 Everything in this guide that looks like `this` should be typed exactly as shown into Terminal.

---

## Navigating to the Project Folder

Every time you open a new Terminal window, you need to navigate to the project folder first.

**On Mac, the project is located at:**
```
~/Downloads/Claude Code Interior Design Skill/pilot-cognitive-test
```

**Type this command** (copy-paste it exactly — there are spaces in the path):
```bash
cd ~/Downloads/Claude\ Code\ Interior\ Design\ Skill/pilot-cognitive-test
```

> 💡 The `\` before each space is required. This tells Terminal the space is part of the name, not a new word.

**Confirm you're in the right place:**
```bash
pwd
```
This prints the current folder. It should end with `pilot-cognitive-test`.

---

## Setting Up Environment Variables (First Time Only)

The app needs secret keys to connect to Supabase and PostHog. These live in a file called `.env.local`.

**Create the file:**
```bash
touch .env.local
```

**Open it:**
```bash
open .env.local
```

This opens the file in TextEdit. Paste in the following and fill in your real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_POSTHOG_KEY=phc_your-posthog-key-here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_ADMIN_EMAIL=your@email.com
```

Save the file (⌘ + S) and close TextEdit.

> ⚠️ **Never upload `.env.local` to GitHub.** It contains secret keys. The project is already configured to ignore it.

**Where to find these values:**
- Supabase keys: Supabase dashboard → your project → Settings → API
- PostHog key: PostHog dashboard → your project → Settings → Project API Key

---

## Installing Dependencies (First Time or After Pull)

"Dependencies" are the packages the app needs to run. Install them with:

```bash
npm install
```

**What this does:** Downloads all required packages into a `node_modules` folder. This can take 1–2 minutes.

**When to run it:**
- The very first time you set up the project
- Any time you see an error saying a package is missing
- After pulling new code that added new packages

---

## Starting the Development Server

```bash
npm run dev
```

**What this does:** Starts a local version of the website running only on your computer.

**When it's ready, you'll see:**
```
▲ Next.js 14.2.5
- Local: http://localhost:3000
```

**Open the site:** Go to [http://localhost:3000](http://localhost:3000) in your browser.

> 💡 `localhost:3000` is a private address — it only works on your computer. Nobody else can see it.

### Stopping the Dev Server

Press **Ctrl + C** in Terminal (hold Control and press C). You'll see the server stop.

### Restarting After Changes

Most changes apply automatically without restarting. But if something seems stuck:
1. Press **Ctrl + C** to stop
2. Type `npm run dev` to start again

---

## Making and Previewing Changes

1. Open the project folder in a code editor (VS Code recommended — download at [code.visualstudio.com](https://code.visualstudio.com))
2. Edit any file and save it
3. Refresh your browser at [http://localhost:3000](http://localhost:3000) — changes appear automatically
4. When happy with the change, deploy to production (see [DEPLOYMENT.md](DEPLOYMENT.md))

---

## Common Commands

### Check if the build works before deploying
```bash
npm run build
```
**What this does:** Runs the same process Vercel uses to build the live site. If this passes, the live site will work. Run this before every deployment to catch errors early.

### Check for TypeScript errors
```bash
npx tsc --noEmit
```
**What this does:** Checks the code for type errors without building anything. If it produces no output, everything is fine.

### See what files you've changed
```bash
git status
```
**What this does:** Lists files you've modified since the last save (commit). Green = staged, Red = not staged.

---

## Clearing the Build Cache

If the site looks wrong or old code keeps appearing, clear the cache:

```bash
rm -rf .next
```

**What this does:** Deletes the `.next` folder, which is where Next.js stores its compiled files. It will be rebuilt automatically next time you run `npm run dev` or `npm run build`.

After clearing:
```bash
npm run dev
```

---

## Reinstalling All Packages (Nuclear Reset)

If `npm install` fails, packages seem corrupted, or you get strange errors:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

**What this does:**
- `rm -rf .next node_modules` — deletes the compiled cache AND all packages
- `npm install` — re-downloads all packages fresh
- `npm run dev` — starts the server

> ⚠️ This takes a few minutes. Don't close Terminal while it's running.

---

## Project Folder Structure

```
pilot-cognitive-test/
├── app/                    ← All pages (each folder = a URL route)
│   ├── page.tsx            ← Homepage (superbrain.social/)
│   ├── leaderboard/        ← /leaderboard page
│   ├── tests/              ← /tests, /tests/reaction, etc.
│   ├── admin/feedback/     ← /admin/feedback (admin only)
│   └── ...
├── components/             ← Reusable UI parts shared across pages
├── lib/                    ← Business logic (Supabase, analytics, scoring)
├── docs/                   ← This documentation
├── public/                 ← Static files (images, icons)
├── .env.local              ← Secret keys (NOT uploaded to GitHub)
├── package.json            ← Lists all packages the project uses
├── tailwind.config.ts      ← Styling configuration
└── next.config.js          ← Next.js configuration
```

### Key Files to Know

| File | What It Controls |
|---|---|
| `app/layout.tsx` | The wrapper around every page (nav, footer, fonts) |
| `app/globals.css` | Global styles and colour variables |
| `components/Nav.tsx` | The top navigation bar |
| `components/Footer.tsx` | The footer with links |
| `lib/supabase.ts` | Supabase connection setup |
| `lib/analytics.ts` | PostHog event tracking setup |

---

## If the Terminal Closes or You Open a New One

You need to navigate back to the project folder each time:
```bash
cd ~/Downloads/Claude\ Code\ Interior\ Design\ Skill/pilot-cognitive-test
npm run dev
```

---

## Environment Variables — Local vs Production

| Variable | Local dev (`.env.local`) | Production (Vercel) |
|---|---|---|
| Supabase URL | Paste your project URL | Same value, set in Vercel dashboard |
| Supabase Anon Key | Paste your anon key | Same value, set in Vercel dashboard |
| PostHog Key | Can leave blank — analytics won't fire | Set in Vercel — required for analytics |
| Admin Email | Your email | Your email |

> 💡 If `NEXT_PUBLIC_POSTHOG_KEY` is empty in `.env.local`, analytics simply won't track anything. This is fine for development — it means you won't pollute your production analytics data with your own testing.
