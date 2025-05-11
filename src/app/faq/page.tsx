export default function FAQPage() {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16 text-sm leading-7 text-gray-800">
        <h1 className="text-2xl font-bold mb-8">Frequently Asked Questions</h1>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">What is Toodl?</h2>
          <p>
            Toodl is a modern expense-sharing app designed to help friends, roommates, families, and travel groups easily track and settle up shared costs. It&apos;s fast, private, and requires no sign-in to get started.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">What makes Toodl different from other apps like Splitwise?</h2>
          <ul className="list-disc ml-5 mt-2">
            <li><strong>Instant access:</strong> Start anonymously—no login required.</li>
            <li><strong>Smart Summary:</strong> See what&aposs owed at a glance with our Summary tab.</li>
            <li><strong>Payment minimization:</strong> We reduce the number of payments needed to settle a group.</li>
            <li><strong>Clean UI:</strong> Focused, mobile-friendly design with minimal clutter.</li>
          </ul>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">How does the Summary tab work?</h2>
          <p>
            The Summary tab shows a smart overview of your current situation across all groups:
          </p>
          <ul className="list-disc ml-5 mt-2">
            <li>How much you owe or are owed</li>
            <li>Who you owe money to, and who owes you</li>
            <li>Recent payments and settlements</li>
          </ul>
          <p className="mt-2">
            It&apos;s designed to surface only what matters to you. If everything is settled, it even celebrates that 🎉.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">How does Toodl minimize payments?</h2>
          <p>
            Toodl calculates everyone&apos;s balances, then automatically figures out the minimal set of payments needed to settle debts. This reduces awkward &quot;Alice pays Bob who pays Carol&aquot; chains. You only see who you personally need to pay or receive from.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">Can I use Toodl offline?</h2>
          <p>
            Yes, partially. If you&aposve already opened a group, most of your data is cached locally. You can continue to view and add expenses while offline, and the app will sync once you&apos;re back online.
          </p>
          <p className="mt-2">
            However, to share groups or settle across users, internet access is required.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">Do I need to create an account?</h2>
          <p>
            No! You can use Toodl anonymously. We assign you a temporary ID (e.g., <code>user_b7g9</code>) so you can start splitting expenses immediately.
          </p>
          <p className="mt-2">
            If you’d like to save your groups or access from multiple devices, you can sign in via Google or email.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">Is my data private?</h2>
          <p>
            Yes. We store only the data needed to support group expenses. We never sell your information, and all communication is encrypted.
          </p>
          <p className="mt-2">
            You can delete your groups or account at any time.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">Can I settle up directly through the app?</h2>
          <p>
            Currently, Toodl doesn’t handle direct payments. However, we support integrations like Venmo or PayPal—just click “Settle Up” and choose your preferred method. Once you’ve paid, you can mark the transaction as settled.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">What happens if two people update the same group?</h2>
          <p>
            The latest update wins. We currently recommend one person manages a group actively at a time. Future updates will support real-time collaboration.
          </p>
        </section>
  
        <section className="mb-8">
          <h2 className="font-semibold text-lg">Is Toodl free?</h2>
          <p>
            Yes. Most core features are free. We also offer Toodl Pro, which adds:
          </p>
          <ul className="list-disc ml-5 mt-2">
            <li>Unlimited groups and expenses</li>
            <li>PDF reports and Excel export</li>
            <li>Auto-reminders and monthly summaries</li>
          </ul>
          <p className="mt-2">
            Our goal is to keep the essential experience accessible for everyone.
          </p>
        </section>
  
        <section>
          <h2 className="font-semibold text-lg">Need help or want to suggest a feature?</h2>
          <p>
            We&quot;d love to hear from you. Email us at <a href="mailto:support@toodl.co" className="text-blue-600 underline">support@toodl.co</a>
          </p>
        </section>
      </main>
    );
  }
  