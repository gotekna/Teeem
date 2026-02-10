# frozen_string_literal: true

class TeeemPdf < ApplicationRecord
  include WarehouseSyncable
  warehouse_type :pdf

  belongs_to :user
  belongs_to :job, optional: true
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # User-created PDFs appear in File Warehouse under Warehousing folder
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  validates :name, presence: true, length: { maximum: 255 }

  # PDF document data structure (JSONB)
  # {
  #   pages: [
  #     {
  #       id: "page-1",
  #       width: 612,   # Points (72 dpi) - Letter = 8.5" = 612pt
  #       height: 792,  # Points - Letter = 11" = 792pt
  #       elements: [
  #         {
  #           id: "elem-1",
  #           type: "text",
  #           content: "Hello World",
  #           x: 72, y: 720,  # From bottom-left
  #           fontSize: 24,
  #           fontFamily: "Helvetica",
  #           color: "#000000"
  #         },
  #         {
  #           id: "elem-2",
  #           type: "image",
  #           src: "data:image/png;base64,...",
  #           x: 100, y: 400,
  #           width: 200, height: 150
  #         },
  #         {
  #           id: "elem-3",
  #           type: "rectangle",
  #           x: 50, y: 300,
  #           width: 100, height: 50,
  #           fillColor: "#0066CC",
  #           borderColor: "#003366",
  #           borderWidth: 2
  #         }
  #       ]
  #     }
  #   ],
  #   metadata: {
  #     title: "Document Title",
  #     author: "Author Name",
  #     subject: "Subject",
  #     keywords: ["key1", "key2"],
  #     version: 1
  #   }
  # }
  before_create :set_default_data

  scope :recent, -> { order(updated_at: :desc) }
  scope :templates, -> { where(is_template: true) }
  scope :user_pdfs, -> { where(is_template: false) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :unattached, -> { where(job_id: nil) }

  # ========================================
  # Warehouse Path (SSoT: WarehouseProvider)
  # ========================================

  # SSoT: Full warehouse path including filename
  # Include ID to prevent collisions when multiple PDFs have the same name
  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}_#{id}.pdf".gsub(%r{/+}, "/")
  end

  # SSoT: Folder path for File Warehouse Doc Tree
  # Job-attached: "Jobs/{JobCode}/TeeemPDF", Standalone: "Warehousing/TeeemPDF/{UserName}/{Year}"
  def warehouse_folder_path
    if job.present?
      "Jobs/#{job.job_code}/TeeemPDF"
    else
      user_name = user&.name || "Unknown"
      year = (created_at || Time.current).year
      "Warehousing/TeeemPDF/#{user_name}/#{year}"
    end
  end

  # Safe filename (remove special characters)
  def safe_filename
    name.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip.presence || "Untitled"
  end

  private

  def set_default_data
    self.data ||= default_pdf_data
    self.page_count = (data["pages"]&.length || 1)
  end

  def default_pdf_data
    {
      pages: [
        {
          id: "page-1",
          width: 612,   # Letter size width in points
          height: 792,  # Letter size height in points
          elements: []
        }
      ],
      metadata: {
        title: name,
        author: user&.name || "",
        version: 1
      }
    }
  end
end
