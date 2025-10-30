"use client";

import Link from "next/link";

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="mx-auto max-w-3xl space-y-10 rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">
            Data Deletion Instructions
          </h1>
          <p className="text-sm text-slate-500">
            This page explains how to request removal of any personal data stored
            by the Toodl budgeting apps.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Option 1 — Remove data yourself
          </h2>
          <ol className="list-decimal space-y-3 pl-6 text-sm text-slate-600">
            <li>
              Sign in to the app with the same provider you originally used
              (Google, Microsoft, Facebook, or anonymous nickname).
            </li>
            <li>
              Open each shared group you created and use the{" "}
              <strong>Settings → Delete group</strong> action to remove it. This
              erases all expenses and member details for that group.
            </li>
            <li>
              If you only used the anonymous nickname flow, open{" "}
              <strong>Profile → Reset identity</strong> to remove the locally
              stored nickname and avatar from your browser.
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Option 2 — Ask our team to delete it
          </h2>
          <p className="text-sm text-slate-600">
            Send an email to{" "}
            <a
              href="mailto:privacy@payout.app?subject=Data%20Deletion%20Request"
              className="font-medium text-indigo-600 underline"
            >
              privacy@payout.app
            </a>{" "}
            from the same email address you used to sign in. Please include:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-600">
            <li>Your full name (or nickname if you used the anonymous flow).</li>
            <li>
              The email address tied to your account (required for Google,
              Microsoft, or Facebook sign-ins).
            </li>
            <li>The names of any groups you would like removed (optional).</li>
          </ul>
          <p className="text-sm text-slate-600">
            We will confirm ownership of the account and erase associated records
            from our database within 7 business days.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-600">
          <h2 className="text-xl font-semibold text-slate-800">Need help?</h2>
          <p>
            If you have questions about the data we store or need help confirming
            deletion, reach out at{" "}
            <a
              href="mailto:privacy@payout.app"
              className="font-medium text-indigo-600 underline"
            >
              privacy@payout.app
            </a>{" "}
            or review our{" "}
            <Link
              href="/privacy"
              className="font-medium text-indigo-600 underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
