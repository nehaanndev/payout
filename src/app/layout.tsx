import "./globals.css";
import Footer from "@/components/Footer";
import ToodlMindProvider from "@/components/mind/ToodlMindProvider";
import MindIdentityBridge from "@/components/mind/MindIdentityBridge";
import ToodlMindLauncher from "@/components/mind/ToodlMindLauncher";
import { AppShell } from "@/components/layout/AppShell";

// app/layout.tsx
export const metadata = {
  title: "Toodl: AI-first ledger for Split, Pulse, Story, Flow, Orbit",
  description:
    "Start a conversation with Toodl AI and watch Split, Pulse, Story, Flow, and Orbit stay perfectly in sync across bills, budgets, journals, plans, and saves.",
  openGraph: {
    title: "Toodl: AI-first ledger",
    description:
      "Tell the AI once—Split settles tabs, Pulse steers budgets, Story journals, Flow plans, and Orbit keeps every spark.",
    url: "https://toodl.co",
    images: ["https://toodl.co/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Toodl",
    description: "AI conversations that update Split, Pulse, Story, Flow, and Orbit.",
    images: ["https://toodl.co/twitter-image.png"],
  },
  alternates: {
    canonical: "https://toodl.co",
  },
};


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <ToodlMindProvider>
          <MindIdentityBridge />
          <AppShell>
            <main className="flex-grow">{children}</main>
            <Footer />
          </AppShell>
          <ToodlMindLauncher />
        </ToodlMindProvider>
      </body>
    </html>
  );
}
