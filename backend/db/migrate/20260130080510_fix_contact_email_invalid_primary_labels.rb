# frozen_string_literal: true

# FRC (Jan 2026): Contact#email= was using label 'Primary' which is not a valid label.
# ContactEmail::ALLOWED_LABELS = %w[work personal login other]
# This migration fixes existing records that have invalid 'Primary' label.
class FixContactEmailInvalidPrimaryLabels < ActiveRecord::Migration[8.0]
  def up
    # Fix all contact_emails with invalid 'Primary' label
    # Change to 'work' which is the default for business emails
    updated_count = ContactEmail.where(label: 'Primary').update_all(label: 'work')
    Rails.logger.info "[Migration] Fixed #{updated_count} contact_emails with invalid 'Primary' label -> 'work'"
  end

  def down
    # Reversible but not recommended - 'Primary' is not a valid label
    # This is here only for migration rollback safety
    ContactEmail.where(label: 'work').update_all(label: 'Primary')
  end
end
