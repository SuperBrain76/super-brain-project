# Troubleshooting Guide

This guide covers the most common problems with SuperBrain and exactly how to fix them.

---

## The Site Is Down or Not Loading

### Step 1 — Check if it's a Vercel outage

Go to [vercel.com/status](https://vercel.com/status). If there's an incident, wait for Vercel to resolve it.

### Step 2 — Check if a deployment broke it

1. Go to [vercel.com](https://vercel.com) → your project → **Deployments**
2. Look at the most recent deployment — is it red (failed)?
3. If yes: click the three dots next to the previous green deployment → **Redeploy**
4. Wait 1–2 minutes, then reload the site

### Step 3 — Check DNS

Go to [dnschecker.org](https://dnschecker.org), type `superbrain.social`, select **A record**.
- Should show `76.76.21.21` from most locations
- If it shows nothing: DNS may have been accidentally deleted. See [DOMAIN_SETUP.md](DOMAIN_SETUP.md)

### Step 4 — Check domain expiry

Namecheap → Domain List → check the **Expires** column. If the domain has expired, renew it immediately.

---

## Vercel Build Failed

A red deployment means the code has an error that prevents it from building.

1. Vercel → Deployments → click the failed (red) deployment
2. Scroll through the build log — look for a line that starts with `Error:`
3. The error will name the file and line number

### Common build errors:

| Error message | What it means | Fix |
|---|---|---|
| `Type error: ...` | TypeScript found a type mismatch | Fix the type error in the named file |
| `Module not found: Can't resolve '...'` | A missing import or package | Run `npm install` locally and commit the updated `package-lock.json` |
| `Environment variable ... is missing` | A required env var isn't set in Vercel | Add it in Vercel → Settings → Environment Variables |
| `Cannot find module '@/...'` | An import path is wrong | Check that the imported file actually exists |

After fixing, push the change to GitHub — Vercel will automatically retry.

---

## Styles Are Broken (Plain White Page / No Styling)

This happened before and is caused by a CSS processing issue.

**Check `app/globals.css`** — the first three lines should be:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Any `@import url(...)` must appear BEFORE these three lines. If a `@import` appears after `@tailwind`, it breaks the entire stylesheet.

**Fix:**
1. Open `app/globals.css`
2. Move any `@import url(...)` lines to the very top
3. Or remove them entirely (Google Fonts should be in `<link>` tags in `app/layout.tsx` instead)

**Also try:** Delete the build cache and restart:
```bash
rm -rf .next
npm run dev
```

---

## Tests Aren't Saving to Leaderboard

### Check 1 — Is the user logged in?

Results only save for logged-in users. Confirm the user sees their name in the nav bar.

### Check 2 — Is Supabase connected?

1. Go to [supabase.com](https://supabase.com) → your project → **Settings** → **API**
2. Copy the Project URL and anon key
3. Check they match what's in Vercel → Settings → Environment Variables

If the values are different, update Vercel and redeploy.

### Check 3 — Look at the browser console

Right-click anywhere on the site → **Inspect** → **Console** tab. Look for red error messages after taking a test. Common ones:

| Console error | Fix |
|---|---|
| `Failed to fetch` | Network issue or Supabase URL is wrong |
| `JWT expired` | User's session expired — they need to log out and back in |
| `new row violates row-level security policy` | RLS is blocking the insert — contact a developer |
| `function get_challenge_result does not exist` | The RPC function hasn't been created in Supabase |

---

## Share Links / Challenge Links Are Broken

### "Challenge not found" error

This means the share ID doesn't exist in Supabase.

1. Supabase → Table Editor → `test_results`
2. Filter by `share_id` = the UUID from the URL
3. If the row doesn't exist, the result wasn't saved correctly

### Open Graph image not loading (no preview image when sharing to WhatsApp)

1. This can take a few minutes to propagate after a new deployment
2. Test the OG image directly: go to `https://superbrain.social/share/[shareId]/opengraph-image`
3. If it shows an error, check Vercel logs for the edge function error

### "Supabase not configured" message on challenge page

The environment variables are missing. Check:
- Vercel → Settings → Environment Variables → all five variables are set
- After adding them, trigger a new deployment

---

## Users Can't Sign Up or Log In

### "Email already registered" but they can't log in

1. Supabase → **Authentication** → **Users**
2. Search for their email
3. Check if **Email confirmed** is ticked
4. If not: click the three dots → **Send confirmation email** (or manually confirm)

### "Invalid login credentials"

The user's password is wrong. Direct them to the **Forgot Password** link on the login page.

### Sign-up confirmation email not arriving

1. Supabase → **Authentication** → **Email Templates** — check the from address is correct
2. Ask the user to check their spam folder
3. Supabase → **Authentication** → **Users** → find the user → manually confirm their email

---

## Admin Feedback Page Not Working

**"Access denied" when you should have access:**

1. Vercel → Settings → Environment Variables
2. Check `NEXT_PUBLIC_ADMIN_EMAIL` is set to exactly your email address (no spaces, correct case)
3. Make sure you're logged into the site with that same email address

**Feedback page shows blank / loading forever:**

1. Open browser console — look for a Supabase error
2. Common cause: the `get_all_feedback` SQL function doesn't exist in Supabase
3. Go to Supabase → SQL Editor → check if `get_all_feedback` exists under Functions

---

## Analytics Not Tracking

### Events not appearing in PostHog

1. Check `NEXT_PUBLIC_POSTHOG_KEY` is set correctly in Vercel
2. Check the PostHog project is active (PostHog → your project → Settings)
3. Check browser console for PostHog errors (filter for "posthog" in the console)

### Analytics tracking your own activity

Use a separate browser profile or incognito mode for testing. Or:
1. PostHog → your person profile → **Opt out of session recording**

---

## Local Development Problems

### `npm run dev` fails to start

Try the nuclear reset:
```bash
rm -rf .next node_modules
npm install
npm run dev
```

### Changes not appearing in browser

Hard refresh: hold **Shift** and click the browser refresh button (or Cmd+Shift+R on Mac).

If still stuck, clear the build cache:
```bash
rm -rf .next
npm run dev
```

### "Module not found" error in terminal

Run `npm install` — a package is missing.

### TypeScript errors in terminal

```bash
npx tsc --noEmit
```

This shows all type errors with file names and line numbers. Fix each one before deploying.

### Can't connect to Supabase locally

Check your `.env.local` file:
```bash
cat .env.local
```

It should have five lines with your real Supabase URL and key. If the file is empty or missing, see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

---

## Emergency Recovery Checklist

If everything seems broken and you don't know where to start:

1. **Roll back the deployment** — Vercel → Deployments → find last green one → Redeploy
2. **Check Vercel status** — [vercel.com/status](https://vercel.com/status)
3. **Check Supabase status** — [status.supabase.com](https://status.supabase.com)
4. **Check the browser console** — right-click → Inspect → Console → look for red errors
5. **Check the Vercel build log** — click the latest deployment → view logs
6. **Verify environment variables** — Vercel → Settings → Environment Variables (all 5 present?)
7. **Check domain** — [dnschecker.org](https://dnschecker.org) → type `superbrain.social`

If none of these reveal the problem, the best next step is to share the error message and Vercel build log with a developer.

---

## Quick Reference

| Problem | First thing to try |
|---|---|
| Site is down | Roll back in Vercel → Deployments |
| Build failed | Click failed deployment → read error log |
| No styling | Check `globals.css` — `@tailwind` must come before any `@import` |
| Results not saving | Check browser console for Supabase errors |
| Share link broken | Check `test_results` table for the share ID |
| Login broken | Supabase → Auth → Users → check email confirmed |
| Analytics missing | Check `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars |
| Local dev broken | `rm -rf .next node_modules && npm install && npm run dev` |
