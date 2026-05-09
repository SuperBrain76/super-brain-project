# Domain Setup Guide

This guide explains how `superbrain.social` is connected to Vercel, and how to manage DNS settings and email forwarding through Namecheap.

---

## How It All Connects

```
superbrain.social (domain name)
        ↓ owned and managed at
Namecheap (domain registrar)
        ↓ DNS records point to
Vercel (hosting)
        ↓ serves the live website
```

**Namecheap** owns the domain name and controls where traffic is directed.  
**Vercel** hosts the actual website.  
**DNS records** are the instructions that link the two together.

---

## Logging Into Namecheap

1. Go to [namecheap.com](https://namecheap.com) and sign in
2. Click **Domain List** in the top navigation
3. Click **Manage** next to `superbrain.social`
4. Click the **Advanced DNS** tab

This is where all DNS records are managed.

---

## Understanding DNS Records

DNS records are like a phone book — they tell browsers where to find your website and where to deliver email.

| Record type | What it does |
|---|---|
| **A record** | Points the domain to an IP address (used for root domain: `superbrain.social`) |
| **CNAME record** | Points a subdomain to another domain (used for `www.superbrain.social`) |
| **MX record** | Tells email where to go (if you have email forwarding set up) |
| **TXT record** | Verification records — proves you own the domain to services like Google |

---

## Current DNS Setup (Vercel)

Vercel provides the DNS values when you add a custom domain. The current setup should look like this:

| Host | Type | Value |
|---|---|---|
| `@` | A | `76.76.21.21` (Vercel's IP) |
| `www` | CNAME | `cname.vercel-dns.com` |

> 💡 The `@` symbol means the root domain (`superbrain.social` with no prefix). `www` means `www.superbrain.social`.

### To verify this is set correctly:

1. Namecheap → Domain List → Manage → **Advanced DNS**
2. Check that both records above exist with the correct values

---

## Adding or Changing the Domain in Vercel

If you ever need to reconnect the domain to a new Vercel project:

1. Vercel → your project → **Settings** → **Domains**
2. Type `superbrain.social` and click **Add**
3. Vercel will show you the DNS values to set
4. Go to Namecheap and update the A record and CNAME to match
5. Wait up to 24 hours for DNS to propagate (usually much faster — often under 10 minutes)

### To check if DNS has propagated:

Go to [dnschecker.org](https://dnschecker.org), type `superbrain.social`, and select **A**. You should see Vercel's IP address (`76.76.21.21`) coming back from most locations.

---

## SSL Certificate (HTTPS)

Vercel manages the SSL certificate (the padlock in the browser) automatically. You don't need to do anything — it renews itself.

If you ever see an "SSL certificate expired" or "Not secure" warning:

1. Vercel → Settings → Domains
2. Click **Refresh** next to the domain
3. Wait a few minutes

---

## Email Forwarding

SuperBrain uses `hello@superbrain.social` as the contact email. This is a forwarding address — emails sent to it get forwarded to your real inbox.

### Setting up email forwarding (Namecheap):

Namecheap offers free email forwarding on any domain they host.

1. Namecheap → Domain List → Manage → **Email Forwarding** tab
2. Click **Add Forwarder**
3. In the first box, type `hello` (the part before the @)
4. In the second box, type the real email address you want messages forwarded to
5. Click the tick to save

**Required DNS records for email forwarding:**

Namecheap adds these automatically when you enable forwarding, but verify they exist under Advanced DNS:

| Host | Type | Value |
|---|---|---|
| `@` | MX | `mx1.privateemail.com` or Namecheap's forwarder |
| `@` | MX | `mx2.privateemail.com` (backup) |

> ⚠️ If you use Vercel's A record AND Namecheap email forwarding, make sure the MX records are not deleted. Both can coexist.

### Testing email forwarding:

Send an email to `hello@superbrain.social` from a different email account. It should arrive in your real inbox within a few minutes.

---

## If the Site Goes Down

If `superbrain.social` stops loading, check in this order:

1. **Is Vercel up?** → Check [vercel.com/status](https://vercel.com/status) or [isitdownrightnow.com](https://isitdownrightnow.com)
2. **Did a deployment break it?** → Vercel → Deployments → roll back to last working version (see [DEPLOYMENT.md](DEPLOYMENT.md))
3. **Is DNS working?** → [dnschecker.org](https://dnschecker.org) → type `superbrain.social` → should show Vercel's IP
4. **Has the domain expired?** → Namecheap → Domain List → check expiry date

---

## Domain Renewal

The domain `superbrain.social` needs to be renewed annually through Namecheap.

1. Namecheap → Domain List → check the **Expires** column
2. Click **Renew** before the expiry date
3. Namecheap will email you reminders — make sure the account email is current

> ⚠️ If the domain expires, the site goes offline immediately. Always renew at least 2 weeks before the expiry date.

### Enable auto-renew:

1. Namecheap → Domain List → Manage → **Domain** tab
2. Toggle **Auto-Renew** to ON

This charges your saved payment method automatically each year.

---

## Subdomains (Optional)

If you ever want to add a subdomain (e.g. `app.superbrain.social` or `blog.superbrain.social`):

1. Namecheap → Advanced DNS → **Add New Record**
2. Type: CNAME
3. Host: `app` (or whatever prefix you want)
4. Value: `cname.vercel-dns.com`
5. Save, then add the subdomain in Vercel → Settings → Domains

---

## Quick Reference

| Task | Steps |
|---|---|
| View DNS records | Namecheap → Domain List → Manage → Advanced DNS |
| Add email forwarding | Namecheap → Domain List → Manage → Email Forwarding |
| Connect domain to Vercel | Vercel → Settings → Domains → Add → update Namecheap DNS |
| Check if DNS propagated | dnschecker.org → type superbrain.social → select A |
| Renew domain | Namecheap → Domain List → Renew |
| Enable auto-renew | Namecheap → Domain List → Manage → Domain → toggle Auto-Renew |
| Troubleshoot SSL | Vercel → Settings → Domains → Refresh |
