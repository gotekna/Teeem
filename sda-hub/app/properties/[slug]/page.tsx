import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bed, Bath, Car, Users, Maximize, MapPin, Phone, Mail } from "lucide-react";
import { getListing } from "@/lib/api";
import { PropertyGallery } from "@/components/PropertyGallery";
import { SdaCategoryBadge } from "@/components/SdaCategoryBadge";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SDA_CATEGORY_LABELS, BUILDING_TYPE_LABELS } from "@/lib/types";
import type { Metadata } from "next";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const listing = await getListing(slug);
    return {
      title: listing.headline || `SDA Property in ${listing.suburb}`,
      description: listing.description?.slice(0, 160) || `Specialist disability accommodation in ${listing.suburb}, ${listing.state}`,
    };
  } catch {
    return { title: "Property Not Found" };
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;

  let listing;
  try {
    listing = await getListing(slug);
  } catch {
    notFound();
  }

  const specs = [
    listing.bedrooms != null && { icon: Bed, label: `${listing.bedrooms} Bed${listing.bedrooms !== 1 ? "s" : ""}` },
    listing.bathrooms != null && { icon: Bath, label: `${listing.bathrooms} Bath${listing.bathrooms !== 1 ? "s" : ""}` },
    listing.parking != null && { icon: Car, label: `${listing.parking} Parking` },
    listing.maxResidents != null && { icon: Users, label: `${listing.maxResidents} Resident${listing.maxResidents !== 1 ? "s" : ""}` },
    listing.floorArea != null && { icon: Maximize, label: `${listing.floorArea}m\u00B2` },
  ].filter(Boolean) as { icon: typeof Bed; label: string }[];

  const featureEntries = Object.entries(listing.sdaFeatures || {}).filter(
    ([, v]) => v === true || (typeof v === "string" && v.length > 0)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/properties"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all properties
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Gallery */}
          <PropertyGallery
            heroImage={listing.heroImage}
            galleryImages={listing.galleryImages}
            alt={listing.headline || `SDA property in ${listing.suburb}`}
          />

          {/* Title & badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                listing.listingType === "for_sale"
                  ? "bg-accent-400 text-white"
                  : "bg-brand-500 text-white"
              }`}>
                {listing.listingType === "for_sale" ? "For Sale" : "Vacancy"}
              </span>
              <SdaCategoryBadge category={listing.sdaCategory} size="md" />
              {listing.buildingType && (
                <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {BUILDING_TYPE_LABELS[listing.buildingType] || listing.buildingType}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
              {listing.headline || `SDA Property in ${listing.suburb}`}
            </h1>

            <div className="mt-2 flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="text-sm">{listing.fullAddress}</span>
            </div>

            {listing.priceDisplay && (
              <p className="mt-3 text-xl font-bold text-brand-500 dark:text-brand-400">
                {listing.priceDisplay}
              </p>
            )}
          </div>

          {/* Specs grid */}
          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-col items-center rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <spec.icon className="h-5 w-5 text-brand-500" />
                  <span className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{spec.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">About This Property</h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {listing.description}
              </div>
            </div>
          )}

          {/* SDA Features */}
          {featureEntries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SDA Features</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {featureEntries.map(([key]) => (
                  <span
                    key={key}
                    className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
                  >
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SDA Category info */}
          {listing.sdaCategory && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {SDA_CATEGORY_LABELS[listing.sdaCategory]} Category
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {listing.sdaCategory === "high_physical_support" &&
                  "High Physical Support homes include features like ceiling hoists, wider corridors, assistive technology, and are designed for people who need very high levels of physical support in their daily activities."}
                {listing.sdaCategory === "fully_accessible" &&
                  "Fully Accessible homes are designed for people who use a wheelchair or have significant physical support needs. They include features like level access, wider doorways, and accessible bathrooms."}
                {listing.sdaCategory === "improved_liveability" &&
                  "Improved Liveability homes feature enhanced physical access, improved safety, and are designed for people with sensory, intellectual, or cognitive disabilities."}
                {listing.sdaCategory === "robust" &&
                  "Robust homes are built to be resilient and reduce the risk of harm to the resident and others. They feature reinforced walls, secure fixtures, and durable materials."}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Provider card */}
          {listing.providerName && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Property Provider</h3>
              <p className="mt-1 text-base font-medium text-gray-700 dark:text-gray-300">{listing.providerName}</p>
              <div className="mt-3 space-y-2">
                {listing.enquiryPhone && (
                  <a
                    href={`tel:${listing.enquiryPhone}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    <Phone className="h-4 w-4" />
                    {listing.enquiryPhone}
                  </a>
                )}
                {listing.enquiryEmail && (
                  <a
                    href={`mailto:${listing.enquiryEmail}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    <Mail className="h-4 w-4" />
                    {listing.enquiryEmail}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Enquiry form */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <EnquiryForm slug={slug} listingType={listing.listingType} />
          </div>
        </div>
      </div>
    </div>
  );
}
