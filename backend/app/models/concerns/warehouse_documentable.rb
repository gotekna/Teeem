# frozen_string_literal: true

# WarehouseDocumentable - SSoT concern for File Warehouse visibility
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  THE ONE concern for warehouse document integration               ║
# ║  Models just declare warehouse_type and get File Warehouse entry  ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   class AssetExpense < ApplicationRecord
#     include WarehouseDocumentable
#     warehouse_type :asset
#   end
#
# This automatically:
# - Creates has_one :warehouse_document association
# - Creates WarehouseDocument entry on create (if storage_blob present)
# - Computes folder path from StorageConfiguration templates
# - Computes display name from model attributes
#
# Supported warehouse types (must match StorageConfiguration::WAREHOUSE_ROOT_DEFAULTS keys):
#   :asset           - Asset expenses, odometer readings, service
#   :financial       - Financial transactions
#   :compliance      - Document tasks (permits, certifications)
#   :people          - People documents (identity docs)
#   :job             - Job documents
#   :task            - Task attachments
#   :corporate       - Corporate documents
#   :email           - Email warehouse
#
module WarehouseDocumentable
  extend ActiveSupport::Concern

  included do
    # Association to warehouse document (SSoT for File Warehouse metadata)
    has_one :warehouse_document, as: :documentable, dependent: :destroy

    # Class attribute for warehouse source type
    class_attribute :warehouse_source_type, default: nil

    # Callbacks
    after_create :create_warehouse_entry, if: :should_create_warehouse_entry?
    after_update :update_warehouse_entry, if: :should_update_warehouse_entry?
  end

  class_methods do
    # Define the warehouse source type for this model
    # @param type [Symbol] One of: :asset, :financial, :compliance, :people, :job, :task, etc.
    def warehouse_type(type)
      self.warehouse_source_type = type.to_s
    end
  end

  # ========================================
  # Public API
  # ========================================

  # Force create/update warehouse entry (useful for backfill)
  # @return [WarehouseDocument, nil] The created/updated warehouse document
  def sync_to_warehouse!
    return nil unless storage_blob_id.present?

    if warehouse_document.present?
      update_warehouse_document!
    else
      create_warehouse_document!
    end
  end

  # Get computed folder path (delegates to WarehouseDocument or computes directly)
  # @return [String, nil] The computed folder path
  def warehouse_folder_path
    if warehouse_document.present?
      warehouse_document.computed_folder_path
    else
      compute_folder_path_for_self
    end
  end

  # Get computed display name for warehouse
  # @return [String] The display name
  def warehouse_display_name
    # Try common attribute names in order of preference
    return title if respond_to?(:title) && title.present?
    return name if respond_to?(:name) && name.present?
    return subject if respond_to?(:subject) && subject.present?
    return file_name if respond_to?(:file_name) && file_name.present?
    return filename if respond_to?(:filename) && filename.present?
    return storage_blob&.original_filename if storage_blob&.original_filename.present?

    # Fallback to descriptive name
    "#{self.class.name.titleize} ##{id}"
  end

  private

  # ========================================
  # Callbacks
  # ========================================

  def should_create_warehouse_entry?
    warehouse_source_type.present? && storage_blob_id.present?
  end

  def should_update_warehouse_entry?
    warehouse_document.present? && saved_change_to_storage_blob_id?
  end

  def create_warehouse_entry
    create_warehouse_document!
  rescue StandardError => e
    Rails.logger.error "[WarehouseDocumentable] Failed to create warehouse entry for #{self.class.name} #{id}: #{e.message}"
    # Don't raise - warehouse visibility shouldn't block document creation
  end

  def update_warehouse_entry
    update_warehouse_document!
  rescue StandardError => e
    Rails.logger.error "[WarehouseDocumentable] Failed to update warehouse entry for #{self.class.name} #{id}: #{e.message}"
  end

  # ========================================
  # Warehouse Document Creation
  # ========================================

  def create_warehouse_document!
    return nil unless storage_blob_id.present?

    tenant = resolve_tenant_for_documentable
    unless tenant
      Rails.logger.warn "[WarehouseDocumentable] #{self.class.name} ##{id}: No tenant found, skipping warehouse entry"
      return nil
    end

    create_warehouse_document!(
      tenant_id: tenant.id,
      source_type: warehouse_source_type,
      storage_blob_id: storage_blob_id,
      display_name: warehouse_display_name,
      folder: compute_folder_path_for_self,
      original_filename: storage_blob&.original_filename,
      content_type: storage_blob&.content_type
    )
  end

  def update_warehouse_document!
    return nil unless warehouse_document.present?

    warehouse_document.update!(
      storage_blob_id: storage_blob_id,
      display_name: warehouse_display_name,
      folder: compute_folder_path_for_self,
      original_filename: storage_blob&.original_filename,
      content_type: storage_blob&.content_type
    )
    warehouse_document
  end

  # ========================================
  # Folder Path Computation (SSoT: StorageConfiguration)
  # ========================================

  def compute_folder_path_for_self
    # Try model's virtual_folder_path first (if defined)
    if respond_to?(:virtual_folder_path)
      begin
        return virtual_folder_path
      rescue StandardError => e
        Rails.logger.debug "[WarehouseDocumentable] virtual_folder_path failed for #{self.class.name} #{id}: #{e.message}"
      end
    end

    # SSoT: Compute from StorageConfiguration
    # ⚠️ FRC (Jan 2026): Must use for_tenant(), not instance - callbacks don't have ActsAsTenant context
    if warehouse_source_type.present?
      begin
        tenant = resolve_tenant_for_documentable
        return nil unless tenant

        config = StorageConfiguration.for_tenant(tenant)
        config.compute_folder_path(
          source_type: warehouse_source_type,
          documentable: self
        )
      rescue StandardError => e
        Rails.logger.debug "[WarehouseDocumentable] compute_folder_path failed: #{e.message}"
        nil
      end
    end
  end

  # Resolve tenant for StorageConfiguration access
  # ⚠️ FRC (Jan 2026): Model callbacks don't have ActsAsTenant context
  # Try multiple strategies to derive tenant from the including model
  def resolve_tenant_for_documentable
    # 1. Direct tenant association
    if respond_to?(:tenant) && tenant.present?
      return tenant
    end

    # 2. tenant_id column
    if respond_to?(:tenant_id) && tenant_id.present?
      return Tenant.find_by(id: tenant_id)
    end

    # 3. Common associations that typically have tenant
    %i[user job contact project corporate_company].each do |assoc|
      if respond_to?(assoc) && send(assoc)&.respond_to?(:tenant) && send(assoc).tenant.present?
        return send(assoc).tenant
      end
    end

    # 4. Try associations with nested tenant path
    if respond_to?(:corporate_company) && corporate_company&.corporate_group&.respond_to?(:tenant)
      return corporate_company.corporate_group.tenant if corporate_company.corporate_group.tenant.present?
    end

    # 5. Fall back to ActsAsTenant if available
    ActsAsTenant.current_tenant
  end
end
