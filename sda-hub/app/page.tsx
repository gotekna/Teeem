import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search, Home, Shield, Heart, Users, Building2, TrendingUp, Handshake } from "lucide-react";
import { PropertyCard } from "@/components/PropertyCard";
import { SDA_CATEGORY_LABELS, SDA_CATEGORY_COLORS } from "@/lib/types";
import { getFeaturedListings } from "@/lib/api";

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getFeatured() {
  try {
    return await getFeaturedListings();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featured = await getFeatured();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
              <Home className="h-3.5 w-3.5" />
              Specialist Disability Accommodation
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find Your Perfect <span className="text-accent-300">SDA Home</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/80 sm:text-xl">
              Browse quality specialist disability accommodation across Australia.
              NDIS-funded housing designed for independence, safety, and community.
            </p>

            {/* Search bar */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/properties"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-brand-600 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl"
              >
                <Search className="h-4.5 w-4.5" />
                Browse All Properties
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-6 py-3 text-base font-semibold text-white transition-all hover:border-white/60 hover:bg-white/10"
              >
                Learn About SDA
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SDA Category Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            SDA Design Categories
          </h2>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Each category is designed to meet different support needs
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(SDA_CATEGORY_LABELS).map(([key, label]) => {
            const colors = SDA_CATEGORY_COLORS[key];
            return (
              <Link
                key={key}
                href={`/properties?category=${key}`}
                className={`group flex flex-col items-center rounded-xl border p-6 text-center transition-all hover:shadow-md hover:-translate-y-0.5 ${colors.bg} ${colors.border}`}
              >
                <div className={`rounded-full p-3 ${colors.text}`}>
                  {key === "high_physical_support" && <Shield className="h-7 w-7" />}
                  {key === "fully_accessible" && <Users className="h-7 w-7" />}
                  {key === "improved_liveability" && <Home className="h-7 w-7" />}
                  {key === "robust" && <Heart className="h-7 w-7" />}
                </div>
                <h3 className={`mt-3 text-base font-semibold ${colors.text}`}>
                  {label}
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {key === "high_physical_support" && "For people who need very high levels of physical support"}
                  {key === "fully_accessible" && "For people who use a wheelchair or have significant mobility needs"}
                  {key === "improved_liveability" && "For people who need a more accessible home environment"}
                  {key === "robust" && "For people who need a resilient home that reduces risk of harm"}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-500 group-hover:underline dark:text-brand-400">
                  View properties <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Listings */}
      {featured.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                  Featured Properties
                </h2>
                <p className="mt-1 text-base text-gray-600 dark:text-gray-400">
                  Latest SDA homes available across Australia
                </p>
              </div>
              <Link
                href="/properties"
                className="hidden items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600 sm:inline-flex dark:text-brand-400"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((listing) => (
                <PropertyCard key={listing.slug} listing={listing} />
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/properties"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                View all properties <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Who We Serve */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            How We Can Help You
          </h2>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Whether you&apos;re a participant, owner, investor, or SIL provider — we&apos;re here for you
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* Property Owners */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-accent-50 p-3 dark:bg-accent-900/30">
                <Building2 className="h-6 w-6 text-accent-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">SDA Property Owners</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Not getting the service you deserve from your current provider? We offer transparent, professional SDA property management powered by TEEEM — real-time reporting, compliance tracking, and vacancy management. Your property deserves better.
                </p>
                <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
                  Switch to us <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Participants / Tenants */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30">
                <Users className="h-6 w-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">SDA Participants</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Looking for your ideal SDA home? Browse quality properties across Australia, filtered by your needs — design category, location, and features. We help you find the right fit for independence and community.
                </p>
                <Link href="/properties" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:underline dark:text-brand-400">
                  Browse properties <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Investors */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/30">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">SDA Investors</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Interested in SDA as an investment? Whether you want to buy an existing SDA property or build a new one, we connect investors with opportunities and manage the full lifecycle. NDIS-backed returns with purpose.
                </p>
                <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:underline dark:text-green-400">
                  Explore investment <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* SIL Providers */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/30">
                <Handshake className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">SIL Providers</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Need the right property for your clients? We match SIL providers with suitable SDA homes — and if the right property doesn&apos;t exist yet, we work with investors to build it. Let us find or create the perfect home for your participants.
                </p>
                <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:underline dark:text-purple-400">
                  Partner with us <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 text-center sm:grid-cols-3">
            {[
              { label: "NDIS-Funded Housing", desc: "All properties are SDA-eligible under the NDIS" },
              { label: "Across Australia", desc: "QLD, NSW, VIC, SA, WA and more" },
              { label: "Powered by TEEEM", desc: "Professional property management you can trust" },
            ].map((stat) => (
              <div key={stat.label}>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{stat.label}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Let&apos;s find the right solution for you
          </h2>
          <p className="mt-2 text-base text-white/80">
            Whether you&apos;re looking for an SDA home, switching providers, investing, or partnering as a SIL provider — get in touch.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-600 shadow hover:bg-gray-50"
            >
              Browse Properties
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-6 py-3 font-semibold text-white hover:border-white/70 hover:bg-white/10"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
