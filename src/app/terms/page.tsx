// app/terms/page.tsx
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — Toodl",
  description: "Read the terms and conditions for using Toodl.",
}

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-sm leading-7 text-gray-700">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>

      <p>Last updated: May 10, 2025</p>

      <h2 className="font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
      <p>By using Toodl, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use the app.</p>

      <h2 className="font-semibold mt-6 mb-2">2. Use of the Service</h2>
      <ul className="list-disc ml-5">
        <li>You must be at least 13 years old to use Toodl.</li>
        <li>You are responsible for the accuracy of expense data you enter.</li>
        <li>You must not abuse or attempt to hack the service.</li>
      </ul>

      <h2 className="font-semibold mt-6 mb-2">3. Account and Data</h2>
      <p>You may delete your account at any time. We reserve the right to suspend accounts that violate these terms.</p>

      <h2 className="font-semibold mt-6 mb-2">4. Limitation of Liability</h2>
      <p>Toodl is provided “as is”. We are not liable for any indirect, incidental, or financial damages caused by use of the service.</p>

      <h2 className="font-semibold mt-6 mb-2">5. Changes to the Terms</h2>
      <p>We may update these Terms. Continued use of Toodl after changes means you accept the revised terms.</p>

      <p className="mt-6">Contact <a href="mailto:support@toodl.co" className="text-primary hover:underline">support@toodl.co</a> with any questions.</p>
    </main>
  )
}
