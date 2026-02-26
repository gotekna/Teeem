/**
 * SSoT for Local Government Area (LGA) constants.
 * Backend SSoT: PriceHistory::VALID_LGAS (price_history.rb)
 * Must stay in sync with backend.
 */
export const QLD_COUNCILS = [
  "Brisbane City Council",
  "City of Gold Coast",
  "Sunshine Coast Regional Council",
  "Lockyer Valley Regional Council",
  "Toowoomba Regional Council",
  "Redland City Council",
  "Scenic Rim Regional Council",
] as const;

export type QldCouncil = (typeof QLD_COUNCILS)[number];

/**
 * Display helper: formats an LGA array for compact display.
 * - All councils = "All LGAs"
 * - Empty = "No LGA"
 * - 1-2 = abbreviated names
 * - 3+ = "N LGAs"
 */
export function formatLga(lga: string[] | null | undefined): string {
  if (!lga || lga.length === 0) return "No LGA";
  if (lga.length === QLD_COUNCILS.length) return "All LGAs";
  if (lga.length <= 2) {
    return lga
      .map((l) => l.replace(/ (City |Regional )?Council/g, "").trim())
      .join(", ");
  }
  return `${lga.length} LGAs`;
}
