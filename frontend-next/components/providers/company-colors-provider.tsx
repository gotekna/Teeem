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

// Default colors (Tekna brand) - fallback if API fails
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
      try {
        // Use cached if available
        if (cachedColors) {
          applyColors(cachedColors);
          setIsLoaded(true);
          return;
        }

        const response = await api.get<BrandResponse>('/api/v1/corporate_company_settings/brand');

        if (response.success && response.data?.colors) {
          cachedColors = response.data.colors;
          applyColors(response.data.colors);
        } else {
          applyColors(DEFAULT_COLORS);
        }
      } catch (error) {
        console.error('[CompanyColors] Failed to load brand colors:', error);
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

  // Muted color (labels, disabled text)
  root.style.setProperty('--muted', colors.muted);
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
    const response = await api.get<BrandResponse>('/api/v1/corporate_company_settings/brand');

    if (response.success && response.data?.colors) {
      cachedColors = response.data.colors;
      applyColors(response.data.colors);
    }
  } catch (error) {
    console.error('[CompanyColors] Failed to refresh brand colors:', error);
  }
}
