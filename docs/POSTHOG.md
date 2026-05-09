# PostHog Analytics Guide

PostHog records what users do on SuperBrain — which pages they visit, which tests they take, and where they drop off. This helps you understand what's working and what isn't.

**Login:** [posthog.com](https://posthog.com) → Sign in → Select your project

---

## What PostHog Tracks

SuperBrain sends the following events to PostHog automatically:

| Event name | When it fires |
|---|---|
| `homepage_view` | User lands on the homepage |
| `test_started` | User begins a test |
| `test_completed` | User finishes a test and sees results |
| `result_shared` | User shares their result (WhatsApp, native share, or copy link) |
| `challenge_opened` | Someone opens a challenge link |
| `challenge_accepted` | Someone clicks "Accept Challenge" |
| `retry_clicked` | User clicks "Retake Test" on the results page |
| `leaderboard_viewed` | User opens the leaderboard |
| `signup_started` | User opens the sign-up form |
| `signup_completed` | User successfully creates an account |
| Page views | Every page navigation (automatic) |

---

## Navigating the PostHog Dashboard

When you log in, you'll see the main dashboard. Key sections in the left sidebar:

| Section | What it shows |
|---|---|
| **Dashboards** | Your saved charts and metrics |
| **Insights** | Build custom charts and breakdowns |
| **Funnels** | See where users drop off in a sequence |
| **Session Replay** | Watch recordings of real user sessions |
| **Events** | Raw stream of every event that fired |
| **Persons** | Individual user profiles |

---

## Viewing Recent Events

To see what's happening in real time:

1. PostHog → **Events** (left sidebar)
2. You'll see a live feed of events as they come in
3. Use the search bar to filter by event name (e.g. type `test_completed` to see only completions)
4. Click any event to see the full details — including the test name, score, and user info

---

## Building a Funnel

A funnel shows how many users complete each step of a sequence. For example: homepage → test started → test completed → shared.

1. PostHog → **Insights** → **New Insight**
2. Select **Funnel** from the top
3. Click **+ Add step** and search for your first event (e.g. `homepage_view`)
4. Add each subsequent step in order
5. Click **Save** to keep this funnel on your dashboard

### Key funnel to set up: Conversion funnel

| Step | Event |
|---|---|
| 1 | `homepage_view` |
| 2 | `test_started` |
| 3 | `test_completed` |
| 4 | `signup_completed` |
| 5 | `result_shared` |

This shows you what percentage of visitors complete the full journey.

---

## Session Replay

Session replay records video of real user sessions so you can watch exactly what they did, where they clicked, and where they got confused.

> 💡 All form inputs and marked text are automatically masked — passwords, emails, and sensitive data never appear in recordings.

### To watch a session:

1. PostHog → **Session Replay** (left sidebar)
2. You'll see a list of recorded sessions
3. Click any session to watch it
4. Use the timeline to jump to interesting moments

### What to look for:

- Users who click something and nothing happens (broken interaction)
- Users who scroll back and forth looking confused
- Users who start a test but leave before finishing
- Rage clicks (rapid clicking on the same spot — indicates frustration)

---

## Creating a Dashboard

A dashboard is a collection of charts you check regularly.

1. PostHog → **Dashboards** → **New Dashboard**
2. Click **+ Add Widget**
3. Select an existing Insight, or create a new one
4. Arrange widgets by dragging them
5. Click **Save**

### Recommended metrics to track:

- Daily/weekly unique visitors
- Test completion rate (funnel)
- Most popular test
- Share rate (how many completers share their result)
- Sign-up conversion rate

---

## Viewing the API Key

If you need to find your PostHog project API key:

1. PostHog → **Settings** (bottom of left sidebar)
2. Click **Project** → **Project API Key**
3. This is your `NEXT_PUBLIC_POSTHOG_KEY`

---

## Troubleshooting

### Events aren't appearing

1. Check the app is running and you're on the live site (events only fire in production if `NEXT_PUBLIC_POSTHOG_KEY` is set)
2. In local development, events only fire if you've added the PostHog key to `.env.local`
3. PostHog → **Events** → check if ANY events appear. If not, the key may be wrong or missing

### Session replay isn't recording

1. PostHog → **Settings** → **Session Replay** — make sure it's enabled
2. Session replay activates automatically when `initPostHog()` is called — check that PostHog initialises on the pages you expect
3. Ad blockers can prevent PostHog from loading — test in a browser without extensions

### PostHog is tracking your own visits

Your own test sessions can pollute your analytics data. To exclude yourself:

1. PostHog → **Settings** → **Persons & groups**
2. Find your person profile
3. Click **Opt out of session recording** — or use a separate browser for testing

Alternatively, the PostHog toolbar (a floating widget you can add) lets you mark yourself as a test user.

---

## Privacy Notes

PostHog is configured to:
- **Mask all form inputs** — no passwords or typed text is recorded
- **Mask marked text** — any element with `data-mask` attribute is hidden in replays
- Use `localStorage+cookie` persistence (standard)
- Not track ad clicks or external referrers beyond what PostHog does by default

No personally identifiable information is sent to PostHog beyond what users voluntarily provide (e.g. display name if they log in).

---

## Quick Reference

| Task | Steps |
|---|---|
| See live events | Events → filter by event name |
| Watch session replays | Session Replay → pick a session |
| Build a funnel | Insights → New Insight → Funnel |
| Find API key | Settings → Project → Project API Key |
| Create a dashboard | Dashboards → New Dashboard → Add Widget |
| Check if tracking works | Events → see if any events appear after visiting site |
