"use client";

import { Wallet, Globe, Shield, CloudOff, Banknote, Rocket, Users, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackToHomeLink } from "@/components/back-to-home-link";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";



export default function AboutPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <BackToHomeLink className="mb-8" />
      {/* Hero */}
      <header className="text-center mb-14">
        <Badge variant="secondary" className="mb-3">About</Badge>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Toodl makes splitting expenses painless
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Built for friends, families, trips, and teams. Fast entry, fair math, and fewer
          awkward payback chats.
        </p>
      </header>

      {/* Quick facts */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2"><Wallet className="h-5 w-5" /><CardTitle>Split in seconds</CardTitle></div>
            <CardDescription>Smart defaults, keyboard-first, and batch adds.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2"><Globe className="h-5 w-5" /><CardTitle>Multi-currency</CardTitle></div>
            <CardDescription>Record in any currency; settle cleanly.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2"><CloudOff className="h-5 w-5" /><CardTitle>Offline-first</CardTitle></div>
            <CardDescription>Works on flaky Wi-Fi; syncs when you’re back.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2"><Shield className="h-5 w-5" /><CardTitle>Privacy-respecting</CardTitle></div>
            <CardDescription>Your data is yours. Minimal collection. Clear exports.</CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Story */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Users className="h-5 w-5" /><CardTitle>Why we built Toodl</CardTitle></div>
            <CardDescription>Shared life deserves simple math.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              Toodl started as a weekend tool for messy group trips and family logistics. We wanted
              something that felt instant, handled multiple currencies without drama, and made
              settling up a one-tap affair. So we designed a flow where adding an expense is faster
              than taking a photo of the receipt—and the math is transparent.
            </p>
            <p>
              Under the hood, we store money in the smallest currency unit (like cents) to avoid
              rounding errors, then render neatly for humans. It’s boring accounting, which is
              exactly why it’s reliable.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Feature deep-dive */}
      <section className="mt-12 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Banknote className="h-5 w-5" /><CardTitle>Fair math</CardTitle></div>
            <CardDescription>Exact splits without penny battles.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We compute in integer minor units (¢, p, etc.) and only format to decimals at the edge,
            so totals always reconcile—even across currencies.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Globe className="h-5 w-5" /><CardTitle>Currency-aware</CardTitle></div>
            <CardDescription>Record expenses exactly as paid.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each expense remembers its currency. View group totals in a base currency with clear
            conversion context when you need it.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Rocket className="h-5 w-5" /><CardTitle>Fast UX</CardTitle></div>
            <CardDescription>Keyboard shortcuts, smart defaults, instant saves.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Designed for speed so your group can log a day’s spending in under a minute.
          </CardContent>
        </Card>
      </section>

      {/* FAQ (No extra component: native <details>/<summary>) */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle>FAQ</CardTitle>
            <CardDescription>Short, honest answers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium hover:underline">
                  <span>How does multi-currency work?</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-3 text-sm text-muted-foreground">
                  Expenses are saved in the currency they were paid in. For summaries, we convert to
                  your chosen base currency using a clear rate source. You’ll always see the
                  original amount and currency next to any converted total.
                </div>
              </details>

              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium hover:underline">
                  <span>Do you lose pennies due to rounding?</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-3 text-sm text-muted-foreground">
                  No. We calculate using minor units (like cents) internally and only format for
                  display at the end. That keeps totals exact and splits fair.
                </div>
              </details>

              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium hover:underline">
                  <span>Does it work offline?</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-3 text-sm text-muted-foreground">
                  Yes. Add and edit expenses without a connection. Changes sync automatically when
                  you’re back online.
                </div>
              </details>

              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium hover:underline">
                  <span>What about privacy?</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-3 text-sm text-muted-foreground">
                  We keep data collection minimal and give you exports. Bank sync is optional and can
                  be disconnected at any time.
                </div>
              </details>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <footer className="mt-14 text-center">
        <div className="inline-flex items-center gap-3">
          <Link
            href="/get-started"
            className={buttonVariants({ size: "lg" })}
            data-testid="cta-create-group"
            aria-label="Create a group"
          >
            Create a group
          </Link>
          <Link
            href="/docs"
            className={buttonVariants({ variant: "outline", size: "lg" })}
            data-testid="cta-read-docs"
            aria-label="Read the docs"
          >
            Read the docs
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Questions? <Link href="mailto:support@toodl.app" className="underline">Email us</Link>.
        </p>
      </footer>

      {/**
       * -------------------------------------------------------------------------
       * TESTS (place this in a separate file): __tests__/about.test.tsx
       * -------------------------------------------------------------------------
       * These tests use Jest + @testing-library/react.
       * Ensure your project has:
       *   - jest
       *   - @testing-library/react
       *   - @testing-library/jest-dom (and add `import "@testing-library/jest-dom"` in setup)
       *   - jsdom test environment
       */}
      {`

      `}
    </main>
  );
}
