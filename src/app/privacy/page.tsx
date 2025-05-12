// app/privacy/page.tsx
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Toodl",
  description: "Learn how Toodl collects, uses, and protects your data.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-sm leading-7 text-gray-700">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <p>Last updated: May 10, 2025</p>

      <p className="mt-6">
        Toodl (“we”, “us”, or “our”) respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our expense sharing app.
      </p>

      <h2 className="font-semibold mt-6 mb-2">1. Information We Collect</h2>
      <ul className="list-disc ml-5">
        <li>Names and email addresses (for account and group membership)</li>
        <li>Group and expense data you explicitly add</li>
        <li>Device and usage information (e.g., browser, IP address)</li>
      </ul>

      <h2 className="font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
      <ul className="list-disc ml-5">
        <li>To provide core app functionality (split expenses, track balances)</li>
        <li>To communicate with you (e.g., notifications, support)</li>
        <li>To improve our product (analytics and usage insights)</li>
      </ul>

      <h2 className="font-semibold mt-6 mb-2">3. Data Sharing</h2>
      <p>We do not sell your data. We only share limited data with infrastructure partners (e.g., Firebase, Vercel) needed to operate the service.</p>

      <h2 className="font-semibold mt-6 mb-2">4. Your Rights</h2>
      <p>You may request deletion of your account or data at any time by contacting support@toodl.co.</p>

      <h2 className="font-semibold mt-6 mb-2">5. Data Security</h2>
      <p>We use industry-standard encryption and authentication mechanisms to protect your data.</p>

      <h2 className="font-semibold mt-6 mb-2">6. Changes to This Policy</h2>
      <p>We may update this Privacy Policy. We&apos;ll notify you of material changes via the app or email.</p>

      <p className="mt-6">If you have questions, contact us at <a href="mailto:support@toodl.co" className="text-primary hover:underline">support@toodl.co</a>.</p>
    </main>
  )
}
