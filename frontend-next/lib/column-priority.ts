export type ColumnPriority = 'essential' | 'supporting' | 'technical' | 'hidden';

export interface ColumnPriorityConfig {
  patterns: RegExp[];
  minWidth: number;
  maxWidth: number;
  truncateAt: number | null;
}

export const COLUMN_PRIORITY_CONFIG: Record<ColumnPriority, ColumnPriorityConfig> = {
  // Tier 1: Essential Business Data
  essential: {
    patterns: [
      /^(name|title|display_name|display_name|company_name)$/i,
      /^address/i,
      /^(email|mobile|primary_email|primary_mobile)$/i,
      /description$/i,
    ],
    minWidth: 150,
    maxWidth: 500,
    truncateAt: null, // Show full text
  },

  // Tier 2: Supporting Data
  supporting: {
    patterns: [
      /^(date|status|category|type)$/i,
      /^(phone|fax)$/i,
      /^(amount|price|cost|total)$/i,
      /^(quantity|count|number)$/i,
    ],
    minWidth: 100,
    maxWidth: 200,
    truncateAt: null, // Show full if fits
  },

  // Tier 3: Technical/System
  technical: {
    patterns: [
      /^id$/i,
      /_(id|uuid|guid)$/i,
      /^xero_/i,
      /^(created_at|updated_at)$/i,
      /^(created_by|updated_by)$/i,
    ],
    minWidth: 60,
    maxWidth: 80,
    truncateAt: 10, // Show first 10 chars + "..."
  },

  // Tier 4: Hidden by default
  hidden: {
    patterns: [
      /^(created_by_id|updated_by_id)$/i,
      /^archived$/i,
      /_raw$/i,
    ],
    minWidth: 0,
    maxWidth: 0,
    truncateAt: 0,
  },
};

export function getColumnPriority(columnName: string, _columnType?: string): ColumnPriority {
  // Check hidden first
  if (COLUMN_PRIORITY_CONFIG.hidden.patterns.some(p => p.test(columnName))) {
    return 'hidden';
  }

  // Check essential
  if (COLUMN_PRIORITY_CONFIG.essential.patterns.some(p => p.test(columnName))) {
    return 'essential';
  }

  // Check technical
  if (COLUMN_PRIORITY_CONFIG.technical.patterns.some(p => p.test(columnName))) {
    return 'technical';
  }

  // Default to supporting
  return 'supporting';
}
