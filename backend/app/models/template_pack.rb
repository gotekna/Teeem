# frozen_string_literal: true

# TemplatePack - Configuration template packages for sharing between tenants
#
# Template packs allow tenants to share their configuration (job types, statuses,
# schedule master templates, etc.) with other tenants.
#
# Visibility levels:
#   - private: Only visible to the source tenant
#   - marketplace: Shared in the customer marketplace
#   - curated: TEEEM official templates (maintained by TEEEM staff)
#
# Status:
#   - draft: Being edited, not yet available
#   - published: Available for use
#   - archived: No longer available (but existing imports remain)
#
class TemplatePack < ApplicationRecord
  belongs_to :source_tenant, class_name: "CorporateGroup"
  belongs_to :created_by, class_name: "User", optional: true

  has_many :template_pack_items, dependent: :destroy

  # =============================================================================
  # Enums
  # =============================================================================
  enum :status, { draft: 0, published: 1, archived: 2 }
  enum :visibility, { private_pack: 0, marketplace: 1, curated: 2 }

  # =============================================================================
  # Validations
  # =============================================================================
  validates :name, presence: true
  validates :name, uniqueness: { scope: :source_tenant_id }

  # =============================================================================
  # Scopes
  # =============================================================================

  # Packs available for a tenant to import
  scope :available_for, ->(tenant) {
    where(visibility: [ :curated, :marketplace ])
      .or(where(source_tenant: tenant))
      .where(status: :published)
  }

  # Only curated TEEEM templates
  scope :curated_only, -> { where(visibility: :curated, status: :published) }

  # Marketplace templates (customer-shared)
  scope :marketplace_only, -> { where(visibility: :marketplace, status: :published) }

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Get default template packs for new tenant onboarding
  def self.default_for_onboarding
    curated_only.order(downloads_count: :desc)
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Check if this is a TEEEM curated template
  def curated?
    visibility == "curated"
  end

  # Check if this is available in the marketplace
  def in_marketplace?
    visibility == "marketplace" && status == "published"
  end

  # Check if a tenant can view this pack
  def visible_to?(tenant)
    return true if curated?
    return true if marketplace? && published?
    return true if source_tenant_id == tenant.id

    false
  end

  # Get count of items by type
  def items_count_by_type
    template_pack_items.group(:item_type).count
  end

  # Record a download/import
  def record_download!
    increment!(:downloads_count)
  end

  # Get all item types included in this pack
  def included_item_types
    template_pack_items.pluck(:item_type).uniq
  end

  # Check if pack includes a specific item type
  def includes_item_type?(item_type)
    template_pack_items.exists?(item_type: item_type)
  end
end
