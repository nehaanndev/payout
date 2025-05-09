import "./globals.css";

// app/layout.tsx
export const metadata = {
  title: "Toodl: Expense Splitter – Split bills & settle debts easily",
  description:
    "Toodl makes it friction-free to share costs with friends: create groups, add expenses, and settle up with one click.",
  openGraph: {
    title: "Toodl: Expense Splitter",
    description:
      "Create groups, track who owes what, and settle up seamlessly.",
    url: "https://toodl.co",
    images: ["https://toodl.co/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Toodl",
    description: "Split bills & settle debts with friends.",
    images: ["https://toodl.co/twitter-image.png"],
  },
  alternates: {
    canonical: "https://toodl.co",
  },
};


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
          {children}
      </body>
    </html>
  );
}
