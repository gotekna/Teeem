# frozen_string_literal: true

class TeeemDocument < ApplicationRecord
  include WarehouseSyncable
  warehouse_type :html

  belongs_to :user
  belongs_to :job, optional: true
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # User-created documents appear in File Warehouse under Warehousing folder
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  validates :name, presence: true, length: { maximum: 255 }

  # Default data structure for new documents
  # {
  #   content: "<p></p>",           # TipTap HTML content
  #   version: 1,                    # Schema version for migrations
  #   pageSettings: {
  #     size: "A4",                  # A4, Letter, Legal
  #     orientation: "portrait",     # portrait, landscape
  #     margins: { top: 1, bottom: 1, left: 1, right: 1 }  # inches
  #   }
  # }
  before_create :set_default_data

  scope :recent, -> { order(updated_at: :desc) }
  scope :templates, -> { where(is_template: true) }
  scope :user_documents, -> { where(is_template: false) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :unattached, -> { where(job_id: nil) }

  # ========================================
  # Warehouse Path (SSoT: WarehouseProvider)
  # ========================================

  # SSoT: Full warehouse path including filename
  # Include ID to prevent collisions when multiple documents have the same name
  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}_#{id}.html".gsub(%r{/+}, "/")
  end

  # SSoT: Folder path computed by WarehouseProvider
  def warehouse_folder_path
    WarehouseProvider.instance.resolve_warehouse_path(self, scope: :word_documents)
  end

  # Safe filename (remove special characters)
  def safe_filename
    name.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip.presence || "Untitled"
  end

  private


  def set_default_data
    self.data ||= default_document_data
  end

  def default_document_data
    {
      content: "<p></p>",
      version: 1,
      pageSettings: {
        size: "A4",
        orientation: "portrait",
        margins: { top: 1, bottom: 1, left: 1, right: 1 }
      }
    }
  end
end
