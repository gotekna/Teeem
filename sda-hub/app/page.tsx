import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search, Home, Shield, Heart, Users } from "lucide-react";
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

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { label: "NDIS-Funded Housing", desc: "All properties are SDA-eligible under the NDIS" },
            { label: "Across Australia", desc: "Properties in QLD, NSW, VIC, SA, WA and more" },
            { label: "Managed by TEEEM", desc: "Professional property management platform" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{stat.label}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{stat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-brand-500 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to find your SDA home?
          </h2>
          <p className="mt-2 text-base text-white/80">
            Browse available properties or get in touch with our team.
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
