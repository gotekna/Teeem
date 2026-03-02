# frozen_string_literal: true

# CanonicalLinkable - Links a tenant record to its canonical counterpart
#
# Include in any SM group model that participates in canonical sync.
# Adds the canonical_record association and provides helper methods.
#
# Usage:
#   class SmTrade < ApplicationRecord
#     include CanonicalLinkable
#   end
#
module CanonicalLinkable
  extend ActiveSupport::Concern

  included do
    belongs_to :canonical_record, class_name: "SmCanonicalRecord", optional: true
  end

  # Check if this record is linked to a canonical record
  def canonical?
    canonical_record_id.present?
  end

  # Check if a specific field is overridden locally
  def field_overridden?(field_name)
    (field_overrides || []).include?(field_name.to_s)
  end

  # Mark a field as locally overridden (won't be updated by canonical propagation)
  def add_field_override!(field_name)
    return if field_overridden?(field_name)
    update!(field_overrides: (field_overrides || []) + [field_name.to_s])
  end

  # Remove a local override (field will be updated by canonical propagation again)
  def remove_field_override!(field_name)
    return unless field_overridden?(field_name)
    update!(field_overrides: (field_overrides || []) - [field_name.to_s])
  end

  # Reset all overrides (re-sync all fields from canonical)
  def reset_overrides!
    update!(field_overrides: [])
  end
end
