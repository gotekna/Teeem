# frozen_string_literal: true

# XeroDuplicateItem represents a single contact within a duplicate group
# Stores a snapshot of the contact data at the time of detection for audit purposes
class XeroDuplicateItem < ApplicationRecord
  # Associations
  belongs_to :duplicate_group, class_name: "XeroDuplicateGroup"
  belongs_to :contact

  # Validations
  validates :duplicate_group_id, presence: true
  validates :contact_id, presence: true
  validates :contact_id, uniqueness: { scope: :duplicate_group_id, message: "is already in this duplicate group" }

  # Callbacks
  before_create :snapshot_contact_data

  # Instance methods
  def merge_target?
    is_merge_target
  end

  def mark_as_merge_target!
    # Unmark any other items in the same group
    duplicate_group.xero_duplicate_items.where.not(id: id).update_all(is_merge_target: false)
    # Mark this one as the target
    update!(is_merge_target: true)
  end

  private

  def snapshot_contact_data
    return unless contact

    self.data_snapshot = {
      id: contact.id,
      display_name: contact.display_name,
      company_name: contact.company_name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      tax_number: contact.tax_number,
      email: contact.email,
      mobile_phone: contact.mobile_phone,
      xero_contact_status: contact.xero_contact_status,
      last_synced_at: contact.last_synced_at,
      xero_links_count: contact.contact_external_links.xero.count,
      invoices_count: contact.external_invoices.count,
      created_at: contact.created_at,
      updated_at: contact.updated_at
    }
  end
end
