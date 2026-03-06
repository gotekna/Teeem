export interface SdaListing {
  slug: string;
  headline: string | null;
  description: string | null;
  listingType: "vacancy" | "for_sale";
  priceDisplay: string | null;
  heroImage: string | null;
  galleryImages: string[];
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  address: string | null;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  floorArea: number | null;
  sdaCategory: string | null;
  buildingType: string | null;
  maxResidents: number | null;
  sdaFeatures: Record<string, unknown>;
  providerName: string | null;
  enquiryEmail: string | null;
  enquiryPhone: string | null;
}

export interface ListingsResponse {
  listings: SdaListing[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface FiltersResponse {
  categories: string[];
  buildingTypes: string[];
  states: string[];
  suburbs: string[];
  bedroomOptions: number[];
  listingTypes: string[];
}

export interface EnquiryFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  ndis_number?: string;
}

export const SDA_CATEGORY_LABELS: Record<string, string> = {
  improved_liveability: "Improved Liveability",
  fully_accessible: "Fully Accessible",
  robust: "Robust",
  high_physical_support: "High Physical Support",
};

export const SDA_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  improved_liveability: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  fully_accessible: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  robust: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  high_physical_support: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
};

export const BUILDING_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartment",
  duplex: "Duplex",
  group_home: "Group Home",
  house: "House",
  townhouse: "Townhouse",
  villa: "Villa",
};
