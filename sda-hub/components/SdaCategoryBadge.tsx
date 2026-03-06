import { SDA_CATEGORY_LABELS, SDA_CATEGORY_COLORS } from "@/lib/types";

interface SdaCategoryBadgeProps {
  category: string | null;
  size?: "sm" | "md";
}

export function SdaCategoryBadge({ category, size = "sm" }: SdaCategoryBadgeProps) {
  if (!category) return null;

  const colors = SDA_CATEGORY_COLORS[category] || {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-700",
  };

  const label = SDA_CATEGORY_LABELS[category] || category.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium capitalize ${colors.bg} ${colors.text} ${colors.border} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {label}
    </span>
  );
}
