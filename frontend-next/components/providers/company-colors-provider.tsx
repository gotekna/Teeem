'use client';

/**
 * Company Colors Provider
 *
 * SSoT for company brand colors. Fetches from backend and injects
 * CSS custom properties into :root for theming.
 *
 * The backend returns HSL values (e.g., "161 63% 13%") which are
 * directly usable in CSS variables.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { hasStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';

interface BrandColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  accent: string;
}

interface BrandResponse {
  success: boolean;
  data: {
    colors: BrandColors;
    website_url: string | null;
    logo_url: string | null;
    logo_mobile: string | null;
    logo_dark: string | null;
  };
}

// Default colors (Teeem brand) - fallback if API fails
const DEFAULT_COLORS: BrandColors = {
  primary: '161 63% 13%',
  primaryForeground: '0 0% 100%',
  secondary: '0 0% 97%',
  muted: '0 0% 38%',
  accent: '40 11% 77%',
};

// Cache for brand colors
let cachedColors: BrandColors | null = null;

export function CompanyColorsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadBrandColors() {
      // Check for auth token before making request
      // This prevents 401 errors on login page
      // SSoT: storage-utils.ts for localStorage access
      if (!hasStorageItem(STORAGE_KEYS.TOKEN)) {
        // Not authenticated - use default colors, don't hit API
        applyColors(DEFAULT_COLORS);
        setIsLoaded(true);
        return;
      }

      try {
        // Use cached if available
        if (cachedColors) {
          applyColors(cachedColors);
          setIsLoaded(true);
          return;
        }

        const response = await api.get<BrandResponse>('/api/v1/tenant_settings/brand', {
          skipAuthRedirect: true  // Brand colors are optional - gracefully fall back if not authenticated
        });

        if (response.success && response.data?.colors) {
          cachedColors = response.data.colors;
          applyColors(response.data.colors);
        } else {
          applyColors(DEFAULT_COLORS);
        }
      } catch {
        // Expected to fail when not authenticated - use default colors
        applyColors(DEFAULT_COLORS);
      } finally {
        setIsLoaded(true);
      }
    }

    loadBrandColors();

    // Cleanup on unmount
    return () => {
      // Don't remove colors on unmount - they should persist
    };
  }, []);

  return <>{children}</>;
}

/**
 * Apply brand colors to CSS custom properties
 */
function applyColors(colors: BrandColors) {
  const root = document.documentElement;

  // Primary color (buttons, links, key UI)
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);

  // Secondary color (card backgrounds, hover states)
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', '0 0% 9%'); // Dark text on light bg

  // Muted foreground color (labels, disabled text, secondary text)
  // NOTE: We only set --muted-foreground here, NOT --muted
  // --muted is for UI backgrounds (beige/gray) defined in globals.css
  // --muted-foreground is for text color which can be branded
  root.style.setProperty('--muted-foreground', colors.muted);

  // Accent color (highlights, AI elements)
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', '0 0% 9%');
}

/**
 * Clear cached brand colors (call when colors are updated in admin)
 */
export function clearBrandColorsCache(): void {
  cachedColors = null;
}

/**
 * Force refresh brand colors from API
 */
export async function refreshBrandColors(): Promise<void> {
  clearBrandColorsCache();

  try {
    const response = await api.get<BrandResponse>('/api/v1/tenant_settings/brand', {
      skipAuthRedirect: true  // Brand colors are optional - gracefully fail if not authenticated
    });

    if (response.success && response.data?.colors) {
      cachedColors = response.data.colors;
      applyColors(response.data.colors);
    }
  } catch {
    // Silently fail - brand colors refresh is non-critical
  }
}
