"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { ScrollablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { PhotoGallery } from "@/components/ui/photo-gallery";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Palette } from "lucide-react";
import type { PhotoItem } from "@/components/ui/photo-gallery";

interface ColourSwatch {
  id: string;
  colourName: string;
  brand: string;
  filename: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  contentType: string | null;
  createdAt: string | null;
}

interface BrandGroup {
  brand: string;
  count: number;
  swatches: ColourSwatch[];
}

interface ColourSwatchesResponse {
  success: boolean;
  data: {
    totalCount: number;
    brands: BrandGroup[];
  };
}

function swatchToPhoto(swatch: ColourSwatch): PhotoItem {
  return {
    id: swatch.id,
    name: swatch.colourName,
    url: swatch.imageUrl || "",
    thumbnailUrl: swatch.thumbnailUrl || swatch.imageUrl || "",
    createdAt: swatch.createdAt || undefined,
  };
}

export default function ColourSwatchesPage() {
  const [brands, setBrands] = useState<BrandGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchSwatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/colour_swatches") as ColourSwatchesResponse;
      if (response.success) {
        setBrands(response.data.brands);
        setTotalCount(response.data.totalCount);
      } else {
        setError("Failed to load colour swatches");
      }
    } catch (err) {
      console.error("Failed to fetch colour swatches:", err);
      setError("Failed to load colour swatches. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSwatches();
  }, [fetchSwatches]);

  // Open lightbox for a specific brand group
  const handlePhotoClick = useCallback((brandSwatches: ColourSwatch[], photo: PhotoItem, index: number) => {
    const photos = brandSwatches.map(swatchToPhoto);
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // Loading state
  if (loading) {
    return (
      <ScrollablePage>
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/pricebook" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Colour Swatches</h1>
            <p className="text-sm text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      </ScrollablePage>
    );
  }

  // Error state
  if (error) {
    return (
      <ScrollablePage>
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/pricebook" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Colour Swatches</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Palette className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </ScrollablePage>
    );
  }

  // Empty state
  if (totalCount === 0) {
    return (
      <ScrollablePage>
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/pricebook" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Colour Swatches</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Palette className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No colour swatches found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Run the pricebook photo import to classify colour swatches
          </p>
        </div>
      </ScrollablePage>
    );
  }

  return (
    <ScrollablePage>
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/pricebook" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Colour Swatches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} swatches across {brands.length} brands
          </p>
        </div>
      </div>

      {/* Brand groups */}
      <div className="flex flex-col gap-8">
        {brands.map((brandGroup) => {
          const photos = brandGroup.swatches.map(swatchToPhoto);

          return (
            <div key={brandGroup.brand}>
              {/* Brand header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{brandGroup.brand}</h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  ({brandGroup.count} {brandGroup.count === 1 ? "colour" : "colours"})
                </span>
              </div>

              {/* Swatch grid */}
              <PhotoGallery
                photos={photos}
                onPhotoClick={(photo, index) =>
                  handlePhotoClick(brandGroup.swatches, photo, index)
                }
                thumbnailSize="lg"
                emptyMessage="No swatches in this brand"
              />
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        showDownload
        showOpenExternal={false}
      />
    </ScrollablePage>
  );
}
