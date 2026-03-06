import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Users, Home, Heart } from "lucide-react";
import { SDA_CATEGORY_LABELS, SDA_CATEGORY_COLORS } from "@/lib/types";

export const metadata: Metadata = {
  title: "About SDA",
  description:
    "Learn about Specialist Disability Accommodation (SDA), the four design categories, eligibility, and how to apply through the NDIS.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">
          What is Specialist Disability Accommodation?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          SDA is housing that has been specially designed or modified to suit the needs of people
          with extreme functional impairment or very high support needs. It is funded by the NDIS
          as part of the National Disability Insurance Scheme.
        </p>
      </div>

      {/* Key facts */}
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          { title: "NDIS Funded", desc: "SDA payments are made directly to housing providers by the NDIA, separate from your other NDIS supports." },
          { title: "Purpose Built", desc: "SDA homes are built or modified to meet specific accessibility standards and design categories." },
          { title: "Your Choice", desc: "Participants choose their SDA provider and home. It's about independence, choice, and control." },
        ].map((fact) => (
          <div key={fact.title} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{fact.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{fact.desc}</p>
          </div>
        ))}
      </div>

      {/* SDA Categories */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
          The Four SDA Design Categories
        </h2>
        <p className="mt-3 text-center text-base text-gray-600 dark:text-gray-400">
          Each category addresses different disability support needs with specific design requirements.
        </p>

        <div className="mt-10 space-y-6">
          {[
            {
              key: "improved_liveability",
              icon: Home,
              features: [
                "Improved physical access including wider doorways",
                "Better lighting and acoustic properties",
                "Features for sensory, intellectual, or cognitive disabilities",
                "Luminance contrasting for vision impairment",
                "Smart home technology for independent living",
              ],
            },
            {
              key: "fully_accessible",
              icon: Users,
              features: [
                "Full wheelchair accessibility throughout",
                "Step-free access at all entry/exit points",
                "Accessible kitchen with adjustable benchtops",
                "Roll-in shower and accessible bathroom fixtures",
                "Wider corridors (minimum 1200mm)",
              ],
            },
            {
              key: "robust",
              icon: Heart,
              features: [
                "Reinforced walls and durable materials",
                "Impact-resistant fixtures and fittings",
                "Secure windows and door hardware",
                "Sound insulation between rooms",
                "Designed to reduce risk of harm to resident and others",
              ],
            },
            {
              key: "high_physical_support",
              icon: Shield,
              features: [
                "Ceiling hoists in bedroom and bathroom",
                "Structural provision for assistive technology",
                "Emergency power supply for life-support equipment",
                "Communication technology (intercom, smart systems)",
                "Wider corridors (minimum 1500mm) for hoists",
              ],
            },
          ].map((cat) => {
            const colors = SDA_CATEGORY_COLORS[cat.key];
            return (
              <div
                key={cat.key}
                className={`rounded-xl border p-6 ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${colors.text}`}>
                    <cat.icon className="h-6 w-6" />
                  </div>
                  <h3 className={`text-lg font-bold ${colors.text}`}>
                    {SDA_CATEGORY_LABELS[cat.key]}
                  </h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {cat.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${colors.text}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/properties?category=${cat.key}`}
                  className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${colors.text} hover:underline`}
                >
                  View {SDA_CATEGORY_LABELS[cat.key]} properties <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Eligibility */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
          Am I Eligible for SDA?
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-400">
          SDA funding is available to NDIS participants who meet specific criteria. Not all NDIS
          participants are eligible for SDA — it is designed for those with the highest support needs.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">You may be eligible if:</h3>
          <ul className="mt-3 space-y-2">
            {[
              "You are an NDIS participant",
              "You have an extreme functional impairment, or very high support needs",
              "SDA would deliver a better outcome than other housing options",
              "SDA represents value for money compared to alternatives",
              "Your home and living assessment recommends SDA",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-900/20">
          <h3 className="text-base font-semibold text-brand-900 dark:text-brand-100">How to Apply</h3>
          <ol className="mt-3 space-y-2 text-sm text-brand-800 dark:text-brand-200">
            <li>1. Contact the NDIS (1800 800 110) or your Local Area Coordinator</li>
            <li>2. Request a Home and Living assessment</li>
            <li>3. Your assessor will determine if SDA is appropriate for your needs</li>
            <li>4. If approved, SDA funding will be included in your NDIS plan</li>
            <li>5. Choose an SDA provider and property that suits your needs</li>
          </ol>
        </div>
      </section>

      {/* CTA */}
      <div className="mt-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Ready to explore SDA properties?
        </h2>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
          >
            Browse Properties
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  );
}
