// components/Footer.tsx

import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-gray-600">
        <div>
          <h4 className="text-gray-900 font-semibold mb-2">Product</h4>
          <ul className="space-y-1">
            <li><Link href="/features" className="hover:text-primary">Features</Link></li>
            <li><Link href="/blog" className="hover:text-primary">Blog</Link></li>
            <li><Link href="/pricing" className="hover:text-primary">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-primary">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-gray-900 font-semibold mb-2">Company</h4>
          <ul className="space-y-1">
            <li><Link href="/about" className="hover:text-primary">About</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
            <li><Link href="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-primary">Terms of Service</Link></li>
            <li><Link href="/data-deletion" className="hover:text-primary">Data Deletion</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-gray-900 font-semibold mb-2">Community</h4>
          <ul className="space-y-1">
            <li><a href="https://twitter.com/ToodlApp" target="_blank" rel="noreferrer" className="hover:text-primary">Twitter</a></li>
            <li><a href="https://producthunt.com/posts/toodl" target="_blank" rel="noreferrer" className="hover:text-primary">Product Hunt</a></li>
            <li><a href="https://indiehackers.com/product/toodl" target="_blank" rel="noreferrer" className="hover:text-primary">Indie Hackers</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-gray-900 font-semibold mb-2">Resources</h4>
          <ul className="space-y-1">
            <li><Link href="/changelog" className="hover:text-primary">Changelog</Link></li>
            <li><Link href="/api" className="hover:text-primary">API</Link></li>
            <li><Link href="/status" className="hover:text-primary">Status</Link></li>
          </ul>
        </div>
      </div>

      <Separator />

      <div className="text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Toodl. All rights reserved.
      </div>
    </footer>
  )
}
