import Link from "next/link";
import Image from "next/image";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sdapropertyhub.com.au";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
              <span className="text-base font-bold text-gray-900 dark:text-white">SDA Property Hub</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Connecting people with disability to quality Specialist Disability Accommodation across Australia.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              Quick Links
            </h3>
            <ul className="mt-3 space-y-2">
              {[
                { href: "/properties", label: "Browse Properties" },
                { href: "/properties?listingType=vacancy", label: "Vacancies" },
                { href: "/properties?listingType=for_sale", label: "For Sale" },
                { href: "/about", label: "About SDA" },
                { href: "/contact", label: "Contact Us" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 transition-colors hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SDA Resources */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              SDA Resources
            </h3>
            <ul className="mt-3 space-y-2">
              {[
                { href: "https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation", label: "NDIS SDA Guide", external: true },
                { href: "https://www.ndis.gov.au/participants/home-and-living/specialist-disability-accommodation", label: "SDA for Participants", external: true },
                { href: "https://www.sdafinder.com.au", label: "SDA Finder", external: true },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 transition-colors hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              Contact
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <a href="mailto:hello@sdapropertyhub.com.au" className="hover:text-brand-500 dark:hover:text-brand-400">
                  hello@sdapropertyhub.com.au
                </a>
              </li>
              <li>Brisbane, Queensland, Australia</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            &copy; {new Date().getFullYear()} SDA Property Hub. Powered by{" "}
            <a href="https://teeem.com.au" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-500 hover:underline">
              TEEEM
            </a>
            .
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            SDA Property Hub is not affiliated with the NDIS or NDIA.
          </p>
        </div>
      </div>
    </footer>
  );
}
