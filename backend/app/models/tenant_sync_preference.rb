# frozen_string_literal: true

# Stores sync preferences for config records when creating new tenants
#
# This is used by TEEEM master tenant to define which records should be:
# - Automatically synced to new tenants (compulsory)
# - Offered as options when creating new tenants (choice)
#
# Example:
#   # Mark a contact as compulsory for new tenant creation
#   TenantSyncPreference.set_mode(contact, 'compulsory')
#
#   # Get all compulsory contacts
#   TenantSyncPreference.for_type('Contact').compulsory
#
class TenantSyncPreference < ApplicationRecord
  belongs_to :tenant
  belongs_to :configurable, polymorphic: true

  # Valid sync modes
  SYNC_MODES = %w[compulsory choice].freeze

  validates :configurable_type, presence: true
  validates :configurable_id, presence: true
  validates :sync_mode, inclusion: { in: SYNC_MODES, allow_nil: true }
  validates :configurable_id, uniqueness: { scope: [:tenant_id, :configurable_type] }

  scope :compulsory, -> { where(sync_mode: 'compulsory') }
  scope :choice, -> { where(sync_mode: 'choice') }
  scope :for_type, ->(type) { where(configurable_type: type) }

  # Set the sync mode for a record (creates or updates preference)
  # Pass nil to remove the preference
  def self.set_mode(record, mode, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    raise ArgumentError, "No master tenant found" unless tenant

    if mode.nil?
      where(tenant: tenant, configurable: record).destroy_all
    else
      pref = find_or_initialize_by(tenant: tenant, configurable: record)
      pref.sync_mode = mode
      pref.save!
      pref
    end
  end

  # Bulk set sync mode for multiple records
  def self.bulk_set_mode(records, mode, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    raise ArgumentError, "No master tenant found" unless tenant

    records.each do |record|
      set_mode(record, mode, tenant: tenant)
    end
  end

  # Get sync mode for a specific record
  def self.mode_for(record, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    return nil unless tenant

    find_by(tenant: tenant, configurable: record)&.sync_mode
  end

  # Get all records of a type with their sync modes
  # Returns hash: { record_id => sync_mode }
  def self.modes_for_type(type, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    return {} unless tenant

    where(tenant: tenant, configurable_type: type)
      .pluck(:configurable_id, :sync_mode)
      .to_h
  end

  # Get all compulsory record IDs for a type
  def self.compulsory_ids_for_type(type, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    return [] unless tenant

    compulsory.for_type(type).where(tenant: tenant).pluck(:configurable_id)
  end

  # Get all choice record IDs for a type
  def self.choice_ids_for_type(type, tenant: nil)
    tenant ||= Tenant.find_by(is_master_tenant: true)
    return [] unless tenant

    choice.for_type(type).where(tenant: tenant).pluck(:configurable_id)
  end
end
