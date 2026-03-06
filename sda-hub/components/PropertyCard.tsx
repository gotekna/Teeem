import Link from "next/link";
import Image from "next/image";
import { Bed, Bath, Car, Maximize, Users } from "lucide-react";
import { SdaCategoryBadge } from "./SdaCategoryBadge";
import { BUILDING_TYPE_LABELS } from "@/lib/types";
import type { SdaListing } from "@/lib/types";

interface PropertyCardProps {
  listing: SdaListing;
}

export function PropertyCard({ listing }: PropertyCardProps) {
  return (
    <Link
      href={`/properties/${listing.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
        {listing.heroImage ? (
          <Image
            src={listing.heroImage}
            alt={listing.headline || `SDA property in ${listing.suburb}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-400 dark:text-gray-600">
              <Maximize className="mx-auto h-8 w-8 mb-1" />
              <span className="text-xs">No image</span>
            </div>
          </div>
        )}
        {/* Listing type badge */}
        <div className="absolute left-3 top-3">
          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
            listing.listingType === "for_sale"
              ? "bg-accent-400 text-white"
              : "bg-brand-500 text-white"
          }`}>
            {listing.listingType === "for_sale" ? "For Sale" : "Vacancy"}
          </span>
        </div>
        {/* SDA Category */}
        <div className="absolute right-3 top-3">
          <SdaCategoryBadge category={listing.sdaCategory} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-gray-900 group-hover:text-brand-500 dark:text-white dark:group-hover:text-brand-400">
          {listing.headline || `SDA ${BUILDING_TYPE_LABELS[listing.buildingType || ""] || "Property"} in ${listing.suburb || "Australia"}`}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {listing.fullAddress}
        </p>

        {/* Specs */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          {listing.bedrooms != null && (
            <span className="inline-flex items-center gap-1" title={`${listing.bedrooms} bedroom${listing.bedrooms !== 1 ? "s" : ""}`}>
              <Bed className="h-3.5 w-3.5" />
              {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="inline-flex items-center gap-1" title={`${listing.bathrooms} bathroom${listing.bathrooms !== 1 ? "s" : ""}`}>
              <Bath className="h-3.5 w-3.5" />
              {listing.bathrooms}
            </span>
          )}
          {listing.parking != null && (
            <span className="inline-flex items-center gap-1" title={`${listing.parking} parking space${listing.parking !== 1 ? "s" : ""}`}>
              <Car className="h-3.5 w-3.5" />
              {listing.parking}
            </span>
          )}
          {listing.maxResidents != null && (
            <span className="inline-flex items-center gap-1" title={`Up to ${listing.maxResidents} resident${listing.maxResidents !== 1 ? "s" : ""}`}>
              <Users className="h-3.5 w-3.5" />
              {listing.maxResidents}
            </span>
          )}
        </div>

        {/* Price / provider */}
        <div className="mt-auto flex items-end justify-between pt-3">
          {listing.priceDisplay && (
            <span className="text-sm font-semibold text-brand-500 dark:text-brand-400">
              {listing.priceDisplay}
            </span>
          )}
          {listing.providerName && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {listing.providerName}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
