class PoStatus < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable

  self.sync_key_source = :slug

  has_many :purchase_orders, dependent: :restrict_with_error

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :tenant_id }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  before_destroy :prevent_system_locked_deletion
  before_update :prevent_system_slug_change
  after_save :clear_slug_cache!
  after_destroy :clear_slug_cache!

  SYSTEM_SLUGS = %w[draft pending pending_quote approved sent received invoiced paid cancelled].freeze

  # Thread-safe cached slug lookup (avoids DB hit on every status check)
  def self.id_for_slug(slug)
    slug_to_id_cache[slug] ||= find_by(slug: slug)&.id
  end

  def self.ids_for_slugs(*slugs)
    slugs.flatten.map { |s| id_for_slug(s) }.compact
  end

  def self.clear_slug_cache!
    Thread.current[:po_status_slug_cache] = nil
  end

  private

  def self.slug_to_id_cache
    Thread.current[:po_status_slug_cache] ||= {}
  end

  def clear_slug_cache!
    self.class.clear_slug_cache!
  end

  def prevent_system_locked_deletion
    if system_locked?
      errors.add(:base, "System statuses cannot be deleted")
      throw(:abort)
    end
  end

  def prevent_system_slug_change
    if system_locked? && slug_changed?
      errors.add(:slug, "cannot be changed for system statuses")
      throw(:abort)
    end
  end
end
