"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, LogIn } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/about", label: "About SDA" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-950/95">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="SDA Property Hub home">
          <Image src="/logo-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            SDA Property Hub
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-brand-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-brand-400"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-gray-200 bg-white pb-4 md:hidden dark:border-gray-800 dark:bg-gray-950" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="px-6 pt-2">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              onClick={() => setMobileOpen(false)}
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
