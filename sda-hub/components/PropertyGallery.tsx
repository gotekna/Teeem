"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Maximize } from "lucide-react";

interface PropertyGalleryProps {
  heroImage: string | null;
  galleryImages: string[];
  alt: string;
}

export function PropertyGallery({ heroImage, galleryImages, alt }: PropertyGalleryProps) {
  const allImages = [heroImage, ...galleryImages].filter(Boolean) as string[];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i === 0 ? allImages.length - 1 : i - 1));
  }, [allImages.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i === allImages.length - 1 ? 0 : i + 1));
  }, [allImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, prev, next]);

  if (allImages.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
        <div className="text-center text-gray-400 dark:text-gray-600">
          <Maximize className="mx-auto h-12 w-12 mb-2" />
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {/* Hero */}
        <button
          onClick={() => { setCurrentIndex(0); setLightboxOpen(true); }}
          className={`relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            allImages.length === 1 ? "sm:col-span-2 aspect-video" : "sm:row-span-2 aspect-square"
          }`}
          aria-label="Open gallery"
        >
          <Image src={allImages[0]} alt={alt} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" priority />
        </button>

        {/* Secondary images */}
        {allImages.slice(1, 3).map((img, idx) => (
          <button
            key={img}
            onClick={() => { setCurrentIndex(idx + 1); setLightboxOpen(true); }}
            className="relative aspect-video overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800"
            aria-label={`View image ${idx + 2}`}
          >
            <Image src={img} alt={`${alt} - ${idx + 2}`} fill className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />
            {/* Show +N overlay on last visible image */}
            {idx === 1 && allImages.length > 3 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-lg font-bold text-white">+{allImages.length - 3}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={allImages[currentIndex]}
              alt={`${alt} - ${currentIndex + 1}`}
              width={1200}
              height={800}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {currentIndex + 1} / {allImages.length}
          </div>
        </div>
      )}
    </>
  );
}
