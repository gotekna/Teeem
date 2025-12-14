"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Universal Copy Button - shows copy icon, green check on success
 * Usage: <CopyButton value="text to copy" />
 */
export function CopyButton({ value, className, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1 rounded transition-all",
        "opacity-0 group-hover:opacity-100",
        "hover:bg-muted",
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn(iconSize, "text-green-500")} />
      ) : (
        <Copy className={cn(iconSize, "text-muted-foreground")} />
      )}
    </button>
  );
}

interface CopyableTextProps {
  children: React.ReactNode;
  value?: string; // If not provided, uses children text
  className?: string;
  labelClassName?: string;
  label?: string;
}

/**
 * Universal Copyable Text - wraps any text with copy-on-hover
 * Usage: <CopyableText>Some text</CopyableText>
 * Usage: <CopyableText label="ABN" value="12 345 678 901">12 345 678 901</CopyableText>
 */
export function CopyableText({
  children,
  value,
  className,
  labelClassName,
  label
}: CopyableTextProps) {
  const textValue = value || (typeof children === "string" ? children : "");

  return (
    <div className={cn("group", className)}>
      {label && (
        <p className={cn("text-sm text-muted-foreground", labelClassName)}>{label}</p>
      )}
      <div className="flex items-center gap-2">
        <span>{children}</span>
        {textValue && <CopyButton value={textValue} />}
      </div>
    </div>
  );
}

interface CopyableLinkProps {
  href: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Universal Copyable Link - clickable link with copy button
 * Usage: <CopyableLink href="mailto:x@y.com" value="x@y.com" icon={<Mail />} />
 */
export function CopyableLink({ href, value, icon, className }: CopyableLinkProps) {
  return (
    <div className={cn("flex items-center gap-1.5 group", className)}>
      <a
        href={href}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {icon}
        <span className="truncate">{value}</span>
      </a>
      <CopyButton value={value} />
    </div>
  );
}

interface CopyableFieldProps {
  label: string;
  value: string | null | undefined;
  subtext?: string;
  className?: string;
}

/**
 * Universal Copyable Field - label + value + copy button
 * Usage: <CopyableField label="ABN" value="12 345 678 901" />
 */
export function CopyableField({ label, value, subtext, className }: CopyableFieldProps) {
  if (!value) return null;

  return (
    <div className={cn("group", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{value}</p>
        <CopyButton value={value} />
      </div>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );
}
