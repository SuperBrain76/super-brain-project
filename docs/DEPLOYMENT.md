# Deployment Guide

This guide explains how to publish code changes to the live website at [superbrain.social](https://superbrain.social).

---

## How Deployment Works (Overview)

```
You edit a file on your computer
        ↓
You upload it to GitHub (the code storage)
        ↓
Vercel detects the change automatically
        ↓
Vercel builds and publishes the live site (takes ~1 min)
        ↓
superbrain.social is updated
```

You never need to touch Vercel directly to deploy. Just upload to GitHub and Vercel does the rest.

---

## Step 1 — Open Your Project on GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click your repository (it will be named something like `pilot-cognitive-test` or `superbrain`)
3. You'll see a list of all the project files

---

## Step 2 — Upload a Changed File

GitHub lets you upload files directly in the browser — no command line needed for simple changes.

### For editing an existing file:

1. Navigate to the file you want to change (click through the folders)
2. Click the **pencil icon** (✏️) in the top-right corner of the file view
3. Make your edits in the browser editor
4. Scroll down to **"Commit changes"**
5. In the first box, write a short description of what you changed (see examples below)
6. Leave **"Commit directly to the `main` branch"** selected
7. Click **"Commit changes"**

### For uploading a new file or replacing one entirely:

1. Navigate to the correct folder
2. Click **"Add file"** → **"Upload files"**
3. Drag your file in, or click to browse
4. Scroll down, write a commit message, click **"Commit changes"**

---

## Commit Message Examples

A commit message is a short note describing what you changed. Keep it under 70 characters.

| What you did | Example message |
|---|---|
| Fixed a typo | `fix typo on homepage` |
| Updated contact email | `update contact email to hello@superbrain.social` |
| Added new test | `add number memory test` |
| Fixed a broken page | `fix 404 on /leaderboard` |
| Updated privacy policy | `update privacy policy — add data retention section` |
| Changed button colour | `change CTA button to blue` |

> 💡 Good messages make it easy to find what changed later. Bad: `"update"`. Good: `"fix reaction test timer stopping early"`.

---

## Step 3 — Wait for Vercel to Deploy

After you commit to GitHub:

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click your project
3. Click the **"Deployments"** tab
4. You'll see a new deployment at the top with a spinning indicator — this means it's building
5. When the indicator turns a green tick, it's live

**Typical build time:** 45 seconds to 2 minutes.

### If the build fails:

The indicator turns red. Click on the failed deployment to see the error log. Common causes:

| Error | Fix |
|---|---|
| TypeScript error | Fix the type error in your code and commit again |
| Missing package | Run `npm install` locally and commit the updated `package-lock.json` |
| Environment variable missing | Add it in Vercel → Settings → Environment Variables |
| Syntax error | Check the error log for the file and line number |

---

## Environment Variables in Vercel

Environment variables are secret keys the live site needs. They are set separately from your code.

### Viewing existing variables:

1. Vercel → your project → **Settings** → **Environment Variables**
2. You'll see all variable names (values are hidden)

### Adding a new variable:

1. Click **"Add New"**
2. Enter the name (e.g. `NEXT_PUBLIC_POSTHOG_KEY`)
3. Enter the value
4. Under "Environments", tick **Production**, **Preview**, and **Development**
5. Click **Save**
6. **Redeploy** for the change to take effect (go to Deployments → click the three dots on the latest → Redeploy)

> ⚠️ After adding or changing an environment variable, you must redeploy — the running site won't pick up the new value automatically.

### Current variables the site needs:

| Variable | Where to find the value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → your project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → your project → Settings → API |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → your project → Settings → Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (type this exactly) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Your email address (unlocks /admin/feedback) |

---

## Rolling Back to a Previous Version

If a deployment breaks the live site, you can instantly revert to any previous version:

1. Vercel → your project → **Deployments**
2. Find the last working deployment (look at the timestamps)
3. Click the **three dots (⋯)** next to it
4. Click **"Redeploy"**
5. Confirm — the site reverts to that version within ~30 seconds

> 💡 Rollbacks don't change any code — they just switch which version is live. You can roll forward again the same way.

---

## Files You Should NEVER Upload to GitHub

Some files contain secret keys or generated code that must stay off GitHub.

| File | Why |
|---|---|
| `.env.local` | Contains secret Supabase and PostHog keys |
| `node_modules/` | Thousands of generated package files — Vercel installs these itself |
| `.next/` | Compiled build output — Vercel builds this itself |

> ✅ The project already has a `.gitignore` file that tells GitHub to ignore these. As long as you use the standard upload flow, these files won't be uploaded accidentally.

---

## Pre-Deployment Checklist

Run these before uploading to GitHub to catch errors early:

```bash
npm run build
```

If this completes without errors, the live deployment will succeed. If it fails, fix the error first.

```bash
npx tsc --noEmit
```

This catches TypeScript type errors. If it produces no output, you're good.

---

## Testing on the Live Site After Deployment

After Vercel shows a green tick:

1. Open [superbrain.social](https://superbrain.social) in a **private/incognito window** (avoids cached old version)
2. Test the specific thing you changed
3. Test the homepage loads
4. Test that at least one test runs start-to-finish
5. Test that results save to the leaderboard (if Supabase is working)

---

## Preview Deployments (Advanced)

Every time you create a GitHub Pull Request (instead of committing directly to `main`), Vercel automatically creates a **preview deployment** — a temporary URL where you can test changes without affecting the live site.

This is useful for testing big changes before going live, but not required for simple edits.

---

## Quick Reference

| Task | Steps |
|---|---|
| Deploy a code change | Edit file → GitHub → Commit → Wait for Vercel |
| Add environment variable | Vercel → Settings → Env Vars → Add New → Redeploy |
| Roll back broken deployment | Vercel → Deployments → find old one → Redeploy |
| Check if deploy succeeded | Vercel → Deployments → green tick |
| Check build errors | Vercel → Deployments → click failed build → view logs |
