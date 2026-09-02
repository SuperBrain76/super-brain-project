import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your account — SuperBrain",
  description: "How to delete your SuperBrain account and all associated data.",
};

/**
 * Public account-deletion instructions page.
 * Required by Google Play's Data safety section (the "Delete account URL"
 * shown on the store listing must be a public page describing the steps).
 */
export default function DeleteAccountPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-[15px] leading-relaxed">
      <h1 className="text-3xl font-extrabold mb-6">Delete your SuperBrain account</h1>

      <p className="mb-4">
        You can permanently delete your SuperBrain account and all data associated
        with it at any time, directly in the app or on the website:
      </p>

      <ol className="list-decimal pl-6 space-y-2 mb-8">
        <li>Sign in to your account</li>
        <li>
          Go to <Link href="/settings/profile" className="underline font-semibold">Settings → Profile</Link>
        </li>
        <li>Scroll to <strong>Delete account</strong>, type <strong>DELETE</strong> to confirm, and confirm</li>
      </ol>

      <h2 className="text-xl font-bold mb-3">What gets deleted</h2>
      <p className="mb-4">
        Deletion is immediate and permanent. It removes your account credentials,
        profile (display name, email address), all predictions, league
        memberships, points, IQ history, and any other data linked to your
        account. Nothing is retained after deletion, except records we are
        legally required to keep (none in the normal case).
      </p>

      <h2 className="text-xl font-bold mb-3">Can&apos;t sign in?</h2>
      <p className="mb-4">
        If you can no longer access your account, email{" "}
        <a href="mailto:support@superbrain.social" className="underline">support@superbrain.social</a>{" "}
        from the address you registered with and we will delete the account for you.
      </p>

      <p className="text-sm opacity-70">
        See our <Link href="/privacy" className="underline">privacy policy</Link> for
        full details on how we handle your data.
      </p>
    </main>
  );
}
