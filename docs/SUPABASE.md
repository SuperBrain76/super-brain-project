# Supabase Guide

Supabase is the database behind SuperBrain. It stores user accounts, test scores, leaderboard entries, and feedback.

**Login:** [supabase.com](https://supabase.com) → Sign in → Select your project

---

## What's in the Database

### Tables

| Table | What it stores |
|---|---|
| `test_results` | Every saved test score — user ID, score, test name, share ID, country |
| `user_profiles` | Display name and country for each user |
| `test_feedback` | Responses to the post-test feedback survey |

### Authentication

Supabase manages user accounts automatically. You don't need to touch it directly. Users sign up with email/password through the app.

**To view users:** Supabase dashboard → **Authentication** → **Users**

---

## Navigating the Dashboard

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click your project (it's named after the project)
3. The left sidebar has all the main sections:

| Section | What it does |
|---|---|
| **Table Editor** | View and edit your database rows like a spreadsheet |
| **SQL Editor** | Run custom database queries |
| **Authentication** | View and manage user accounts |
| **Storage** | File storage (not currently used) |
| **Settings → API** | Find your Supabase URL and anon key |

---

## Viewing Data in the Table Editor

1. Click **Table Editor** in the left sidebar
2. Select a table (e.g. `test_results`)
3. You'll see all rows in a spreadsheet view
4. Use the filter bar to search by column value

### Useful filters:

- To find a specific user's results: filter `user_id` equals their ID
- To find recent entries: sort by `created_at` descending
- To find all results for one test: filter `test_name` equals `Reaction Time Test`

---

## Viewing Feedback

The easiest way to view feedback is the **admin page** on the live site:

1. Log in at [superbrain.social](https://superbrain.social) using the admin email address
2. Go to [superbrain.social/admin/feedback](https://superbrain.social/admin/feedback)

This shows all feedback responses in a clean interface.

Alternatively, view raw data in Supabase:
1. Table Editor → `test_feedback`
2. All responses are here with timestamps

---

## Running SQL Queries

The SQL Editor lets you query the database directly. Use it for:
- Counting how many tests have been taken
- Finding the top scores
- Checking if something saved correctly

**To open it:** Supabase dashboard → **SQL Editor** → **New Query**

### Useful queries:

**How many tests have been taken total?**
```sql
SELECT COUNT(*) FROM test_results;
```

**How many unique users have taken tests?**
```sql
SELECT COUNT(DISTINCT user_id) FROM test_results;
```

**Top 10 scores for the Reaction Time Test:**
```sql
SELECT display_name, score, country, created_at
FROM test_results
ORDER BY score DESC
LIMIT 10;
```

**All feedback from the last 7 days:**
```sql
SELECT *
FROM test_feedback
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Count of tests by test name:**
```sql
SELECT test_name, COUNT(*) as total
FROM test_results
GROUP BY test_name
ORDER BY total DESC;
```

> 💡 Click the **Run** button (or press Ctrl/Cmd + Enter) to execute a query.

---

## Database Functions (RPCs)

The app uses several custom database functions. These are pre-written queries stored inside Supabase.

| Function | What it does |
|---|---|
| `get_leaderboard` | Returns top scores for a given test, filtered by time period |
| `get_user_rank` | Returns a user's percentile rank for a given test |
| `get_challenge_result` | Returns score data for the share/challenge pages |
| `get_all_feedback` | Returns all feedback (admin only) |

**To view these:** SQL Editor → left sidebar → **Functions**

You shouldn't need to edit these unless the scoring logic changes.

---

## API Keys

The app needs two values from Supabase to connect:

1. Supabase dashboard → **Settings** → **API**
2. You'll see:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys → anon public** → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ Never share the **service_role** key. Only the **anon** key is safe to use in the app.

---

## Backups

Supabase automatically backs up your database daily on paid plans. To check or download a backup:

1. Supabase dashboard → **Settings** → **Database**
2. Scroll to **Backups**
3. You can download a backup or restore from one here

### Manual backup (export data as CSV):

1. Table Editor → select a table
2. Click **Export** (top right)
3. Download as CSV

---

## Row-Level Security (RLS)

Row-Level Security is a Supabase feature that controls who can read or write each row. SuperBrain uses RLS to:

- Allow anyone to **read** leaderboard entries
- Allow only the **owner** (the user who created it) to insert their own results
- Block all **direct writes** to the `test_feedback` table from the frontend (inserts go through a function)

**You don't need to change RLS** unless you're adding a new table. If you add a table and data isn't saving, it's likely an RLS issue — contact a developer.

---

## Troubleshooting Common Issues

### Data isn't saving

1. Check the browser console (right-click → Inspect → Console) for error messages
2. Common cause: RLS policy blocking the insert
3. Check: Supabase → **Authentication** → Is the user actually logged in?

### "Function does not exist" error

The app is calling an RPC function that hasn't been created in Supabase yet. You'll need to run the SQL to create it. See the SQL in the main project for the function definitions.

### Scores not appearing on leaderboard

1. Check `test_results` table — is the row there?
2. Check the `share_id` column — it should be a UUID, not null
3. Try running `get_leaderboard` manually in the SQL Editor

### User can't sign in

1. Supabase → Authentication → Users → find their email
2. Check if "Email confirmed" is ticked — if not, you can manually confirm it
3. If the account doesn't exist, they need to sign up

---

## Quick Reference

| Task | Where |
|---|---|
| View all test scores | Table Editor → `test_results` |
| View feedback | superbrain.social/admin/feedback or Table Editor → `test_feedback` |
| Find API keys | Settings → API |
| Run a custom query | SQL Editor |
| View user accounts | Authentication → Users |
| Download a backup | Settings → Database → Backups |
| Check database functions | SQL Editor → Functions (left sidebar) |
