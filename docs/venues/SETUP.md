# Venue business — credential checklist

Everything is built and tested. These four accounts are the only things standing
between here and a live send. Add each value to **Vercel → Project → Settings →
Environment Variables** (Production), then redeploy.

Nothing below can be obtained on your behalf — each one needs your account.

---

## 1. Stripe — billing

**Where:** https://dashboard.stripe.com

| Step | Where exactly | Gives you |
|---|---|---|
| a | Developers → API keys → **Secret key** | `STRIPE_SECRET_KEY` (`sk_live_…`) |
| b | Product catalogue → **+ Add product** → "Venue League", price €99, **Recurring / Monthly** → copy the price ID | `STRIPE_PRICE_MONTHLY` (`price_…`) |
| c | Same product → **+ Add another price**, €990, **Recurring / Yearly** | `STRIPE_PRICE_ANNUAL` |
| d | *(optional)* repeat b+c in GBP for UK venues | `STRIPE_PRICE_MONTHLY_GBP`, `STRIPE_PRICE_ANNUAL_GBP` |
| e | Developers → Webhooks → **Add endpoint** → `https://www.superbrain.social/api/stripe/webhook` → copy **Signing secret** | `STRIPE_WEBHOOK_SECRET` (`whsec_…`) |
| f | Settings → Billing → **Customer portal** → Activate | (no variable — enables `/venues/billing`) |

**Webhook events to tick in step (e).** The handler ignores anything else, but
missing one of these silently breaks that path:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end
invoice.payment_succeeded
invoice.payment_failed
```

Optional: `STRIPE_TAX_ENABLED=true` if you have Stripe Tax on — VAT ID
collection for EU B2B reverse charge is already wired either way.

---

## 2. Instantly — cold outreach

**Where:** https://app.instantly.ai

| Step | Where exactly | Gives you |
|---|---|---|
| a | Settings → Integrations → **API** → generate a **V2** key | `INSTANTLY_API_KEY` |
| b | Create 4 campaigns (GB, ES, FR, IT). The ID is in the URL: `app.instantly.ai/app/campaign/`**`<this-part>`** | `INSTANTLY_CAMPAIGN_GB`, `_ES`, `_FR`, `_IT` |
| c | Invent any random string, e.g. `openssl rand -hex 24` | `INSTANTLY_WEBHOOK_TOKEN` |
| d | Each campaign → Settings → **Webhooks** → add `https://www.superbrain.social/api/outreach/instantly?token=<the token from c>` | (no variable) |

**Do not create a DE or AT campaign.** `campaignFor()` returns `null` for both
and the sync skips them — that is UWG §7, not a preference.

Sequence copy to paste in: [`OUTREACH_SEQUENCES.md`](./OUTREACH_SEQUENCES.md).

**Before any of this matters:** buy the sending domain, add 3–4 mailboxes to it
in Instantly, and switch warmup on. Warmup needs ~14 days. This is the long pole.

---

## 3. Google Places — prospecting

**Where:** https://console.cloud.google.com

| Step | Where exactly | Gives you |
|---|---|---|
| a | Create a project (or pick one) | — |
| b | **Billing** → link a billing account (required even inside the free tier) | — |
| c | APIs & Services → Library → search **"Places API (New)"** → Enable | — |
| d | APIs & Services → Credentials → Create credentials → **API key** | `GOOGLE_PLACES_API_KEY` |
| e | Edit that key → API restrictions → **Restrict to Places API (New)** | — |

⚠️ It must be **Places API (New)**, not the legacy "Places API". The code calls
`places:searchText`, which only exists on the new one.

---

## 4. Anthropic — venue fit scoring

**Where:** https://console.anthropic.com

| Step | Where exactly | Gives you |
|---|---|---|
| a | Settings → **API keys** → Create key | `ANTHROPIC_API_KEY` |

Until this is set, enrichment runs the offline heuristic automatically and flags
every row `mock: true`. Adding the key switches it to Claude Haiku 4.5 with no
code change. Force mock on later with `ENRICHMENT_MOCK=1`.

---

## Also required (you may already have these)

| Variable | Notes |
|---|---|
| `CRON_SECRET` | Already used by the fixture crons. GitHub → repo → Settings → Secrets: also add `CRON_SECRET` and `APP_URL` for the new workflows. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API → `service_role`. Already set in production; **missing from `.env.local`**, which is why these pages can't run locally. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.superbrain.social` |
| `VENUE_FROM_EMAIL` | e.g. `SuperBrain Venues <venues@superbrain.social>` — transactional only, never outreach |
| `VENUE_REPLY_TO` | where venue replies land |
| `N8N_VENUE_WEBHOOK_URL` | production URL of the imported `SB-VEN-01` workflow |
| `N8N_WEBHOOK_SECRET` | any random string; set the same value as `SB_WEBHOOK_SECRET` inside n8n |
| `OUTREACH_DAILY_CAP` | start at `200`. This is your warmup ramp. |
| `OUTREACH_MIN_FIT_SCORE` | default `60` |

---

## Rough running cost at 50k venues

| Item | Estimate |
|---|---|
| Google Places sweeps | ~$30–50 per full 4-country pass (Google gives $200/mo free credit) |
| Haiku enrichment | ~$150 total for 50k venues |
| Instantly | ~$97/mo + domain + mailboxes |

---

## Order of operations

1. Buy the sending domain and start Instantly warmup — **today**, everything else waits on it.
2. Stripe (§1) — so a reply can actually convert.
3. Google Places (§3) + Anthropic (§4) — start filling the CRM while warmup runs.
4. Instantly campaigns + webhook (§2) once mailboxes are warm.
5. First 20-venue enrichment batch, eyeball the scores, then let the nightly cron run.
