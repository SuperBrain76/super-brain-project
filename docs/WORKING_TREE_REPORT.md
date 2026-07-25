# Working Tree Report — Phase 0.1

**Date:** 17 July 2026
**Branch:** `main`, in sync with `origin/main`
**HEAD:** `90607cda` — *"Add fix-sf-direct endpoint for SF fixtures (FRA/ESP, ARG/ENG)"* (14 Jul 2026)
**Production deployment:** 3 days old · `pilot-cognitive-test-7tx435gak` · ● Ready · deployed by `kj96-7265`
**Action taken:** none. Nothing staged, committed, stashed or discarded.

---

## Headline

**Production is safe.** The deployed build matches `HEAD`, and `HEAD` contains none of the uncommitted
changes. Every modification below is local-only.

**But one of them must not be deployed as-is.** The `lib/googleAuth.ts` rewrite contains a latent
regression that would break Google sign-in **on the web** — verified against the installed Capacitor
source, not assumed. It is App Store work, unrelated to the World Cup, and the freeze should hold it
where it is.

---

## Inventory

| File | Tracked | Change | Origin | Production risk | Recommendation |
|---|---|---|---|---|---|
| `lib/googleAuth.ts` | ✅ tracked | +33 / −35 — OAuth rewritten to open in Capacitor `Browser` | iOS App Store guideline 4 work | 🔴 **High if deployed** — breaks web Google login | **Preserve. Do not commit.** Stash or move to a branch. |
| `package.json` | ✅ tracked | +1 dep: `@capacitor/browser: ^8.0.3` | Same | 🟢 None alone | Preserve — pairs with the above |
| `package-lock.json` | ✅ tracked | Lockfile for the above | Same (generated) | 🟢 None alone | Preserve — pairs with the above |
| `ios/App/CapApp-SPM/Package.swift` | ✅ tracked | +`CapacitorBrowser` SPM dependency | Same | 🟢 None — iOS build only, not in the web deploy | Preserve — pairs with the above |
| `PRODUCTION_FREEZE.md` | ❌ untracked | New — Phase 0 | Claude, Phase 0 | 🟢 None | Commit |
| `docs/SCHEMA_DRIFT_REPORT.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/MIGRATION_HISTORY_ASSESSMENT.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/EMAIL_CRON_INVESTIGATION.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/FIXTURE_IDENTITY_RISK.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/WORLD_CUP_CLOSURE_CHECKLIST.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/PHASE_1_PLAN.md` | ❌ untracked | New | Claude, Phase 0 | 🟢 None | Commit |
| `docs/WORKING_TREE_REPORT.md` | ❌ untracked | New — this file | Claude, Phase 0.1 | 🟢 None | Commit |
| `scripts/capture-production-schema.sql` | ❌ untracked | New — read-only capture | Claude, Phase 0 | 🟢 None | Commit |
| `scripts/verify-leaderboard-rpc.sql` | ❌ untracked | New — read-only verification | Claude, Phase 0.1 | 🟢 None | Commit |
| `scripts/PROPOSED-019b-leaderboard-tiebreak.sql` | ❌ untracked | New — **proposed, guarded, not approved** | Claude, Phase 0.1 | 🟢 None while unapplied | Commit — the `\quit` guard prevents accidental execution |

All four tracked modifications belong to **one** logical change: the iOS App Store OAuth fix. They
should be committed together or not at all.

---

## `lib/googleAuth.ts` — detailed

### Does the deployed production version differ from the working tree?

**Yes.** Production runs the committed version. The working tree changes are not deployed.

| | |
|---|---|
| **Deployed** | `HEAD` = `90607cda`, deployed 3 days ago, `● Ready`. Contains the **committed** `googleAuth.ts`. |
| **Last commit touching this file** | `30d0bb65` — *"Fix Apple App Store rejection issues - Build 3"* |
| **Working tree** | +33 / −35, uncommitted, undeployed |
| **Verdict** | ✅ **Production is unaffected.** The risk is latent, not live. |

### What the change does

Refactors `signInWithGoogle` / `signInWithApple` into a shared `signInWithProvider`, and routes the
OAuth URL through Capacitor's `Browser.open()` so that on iOS the flow stays inside
`SFSafariViewController` — an App Store guideline 4 requirement. It adds
`skipBrowserRedirect: true` so supabase-js returns the URL instead of navigating.

The intent is correct and the iOS half is right.

### The regression

```ts
async function openOAuthInAppBrowser(url: string): Promise<void> {
  try {
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    // Fallback for non-Capacitor environments (web browser)
    window.location.href = url;
  }
}
```

The fallback assumes `Browser.open()` **throws** on the web. It does not. From the installed package,
`node_modules/@capacitor/browser/dist/plugin.cjs.js`:

```js
class BrowserWeb extends core.WebPlugin {
    async open(options) {
        this._lastWindow = window.open(options.url, options.windowName || '_blank');
    }
}
```

On the web it calls `window.open(url, '_blank')` and resolves normally. Consequences:

1. **The `catch` is dead code on the web.** `window.location.href = url` never runs.
2. **`window.open` is called after an `await`.** The `signInWithOAuth` promise breaks the user-gesture
   chain, so Safari and Chrome will very likely treat the call as programmatic and **block the popup**.
   `window.open` returns `null` — it does not throw — so nothing is caught and nothing is logged.
3. **Net effect: clicking "Continue with Google" on the web silently does nothing.** No redirect, no
   error, no feedback.
4. If a popup *is* permitted, OAuth completes in a detached tab while the original tab still shows the
   login page — a confusing but recoverable outcome.

Either way, with `skipBrowserRedirect: true` the main window never navigates. The committed version
has no such problem: it lets supabase-js redirect the top-level window.

### Why this matters under the freeze

Auth is on the freeze list under *"security or availability"*. If this is committed and deployed
before the final, users who cannot sign in cannot check their standings on the day the prize is
decided. It is exactly the class of change the freeze exists to stop — **and the deploy is one
`git commit && git push` away**, since `main` auto-deploys.

### Recommendation

**Preserve. Do not commit. Do not discard.** The work is wanted — just not now, and not in this form.

```bash
# Suggested (NOT executed — awaiting your approval):
git stash push -m "iOS App Store OAuth via Capacitor Browser — WIP, do not deploy" \
  lib/googleAuth.ts package.json package-lock.json ios/App/CapApp-SPM/Package.swift
```

A branch is the better home if the App Store submission is active:

```bash
git checkout -b feat/ios-oauth-in-app-browser
git add lib/googleAuth.ts package.json package-lock.json ios/App/CapApp-SPM/Package.swift
git commit -m "feat(auth): OAuth via Capacitor Browser for iOS guideline 4"
git checkout main   # main returns to exactly the deployed state
```

**Before it ships (post-freeze), the fallback needs to be platform-detected, not exception-based:**

```ts
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  await Browser.open({ url, presentationStyle: "popover" });
} else {
  window.location.href = url;   // web: top-level redirect, as today
}
```

That keeps the App Store fix on iOS and leaves the working web flow untouched. It needs testing on
web, iOS and Android before deploying — which is Phase 1 work at the earliest.

---

## Why `main` being clean matters

`main` is the deploy branch and is in sync with `origin/main`. Any push to it deploys to production.
With four uncommitted files in the tree, a reflexive `git add -A && git commit && git push` — the most
natural command in the world during an incident — would deploy the auth regression.

**Getting these four files out of the working tree is itself a freeze safety measure**, independent of
whether the change is any good.

---

## Recommended sequence

1. **Approve** stash-or-branch for the four App Store files. *(Awaiting Dylan.)*
2. **Commit** the Phase 0 / 0.1 documentation and scripts — documentation-only, no runtime impact,
   and it gets the freeze doc in front of the team.
3. **Confirm** `git status` is clean afterwards, so `main` matches production exactly for the duration
   of the freeze.
4. **Post-freeze**: resume the App Store work with the platform check above.
