class TeeemSpreadsheet < ApplicationRecord
  include WarehouseSyncable
  warehouse_type :xlsx

  belongs_to :user
  belongs_to :job, optional: true
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # User-created spreadsheets appear in File Warehouse under Warehousing folder
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  validates :name, presence: true, length: { maximum: 255 }

  # Default data structure for new spreadsheets
  # {
  #   sheets: [{ name: "Sheet1", cells: { "A1": { value: "Hello", type: "string" }, ... } }],
  #   activeSheet: 0,
  #   columnWidths: { "A": 100, "B": 100, ... },
  #   frozenRows: 0,
  #   frozenCols: 0
  # }
  before_create :set_default_data

  scope :recent, -> { order(updated_at: :desc) }
  scope :templates, -> { where(is_template: true) }
  scope :user_spreadsheets, -> { where(is_template: false) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :unattached, -> { where(job_id: nil) }

  # ========================================
  # Warehouse Path (SSoT: WarehouseProvider)
  # ========================================

  # SSoT: Full warehouse path including filename
  # Include ID to prevent collisions when multiple spreadsheets have the same name
  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}_#{id}.xlsx".gsub(%r{/+}, "/")
  end

  # SSoT: Folder path computed by WarehouseProvider
  def warehouse_folder_path
    WarehouseProvider.instance.resolve_warehouse_path(self, scope: :excel_documents)
  end

  # Safe filename (remove special characters)
  def safe_filename
    name.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip.presence || "Untitled"
  end

  private


  def set_default_data
    self.data ||= default_spreadsheet_data
  end

  def default_spreadsheet_data
    {
      sheets: [
        {
          name: "Sheet1",
          cells: {}
        }
      ],
      activeSheet: 0,
      columnWidths: {},
      frozenRows: 0,
      frozenCols: 0
    }
  end
end
