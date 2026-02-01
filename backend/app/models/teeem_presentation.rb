# frozen_string_literal: true

class TeeemPresentation < ApplicationRecord
  include WarehouseSyncable
  warehouse_type :pptx

  belongs_to :user
  belongs_to :job, optional: true
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # User-created presentations appear in File Warehouse under Warehousing folder
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  validates :name, presence: true, length: { maximum: 255 }

  # Default data structure for new presentations
  # {
  #   slides: [
  #     {
  #       id: "slide-1",
  #       layout: "title",
  #       background: { color: "#FFFFFF" },
  #       elements: [
  #         {
  #           id: "elem-1",
  #           type: "text",
  #           content: "Click to add title",
  #           x: 0.5, y: 2.5, w: 9, h: 1.5,
  #           options: { fontSize: 44, fontFace: "Arial", bold: true, align: "center" }
  #         }
  #       ],
  #       notes: ""
  #     }
  #   ],
  #   theme: { name: "default", colors: { primary: "#0066CC", secondary: "#333333" } },
  #   metadata: { version: 1 }
  # }
  before_create :set_default_data

  scope :recent, -> { order(updated_at: :desc) }
  scope :templates, -> { where(is_template: true) }
  scope :user_presentations, -> { where(is_template: false) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :unattached, -> { where(job_id: nil) }

  # ========================================
  # Warehouse Path (SSoT: WarehouseProvider)
  # ========================================

  # SSoT: Full warehouse path including filename
  # Include ID to prevent collisions when multiple presentations have the same name
  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}_#{id}.pptx".gsub(%r{/+}, "/")
  end

  # SSoT: Folder path computed by WarehouseProvider
  def warehouse_folder_path
    WarehouseProvider.instance.resolve_warehouse_path(self, scope: :powerpoint_documents)
  end

  # Safe filename (remove special characters)
  def safe_filename
    name.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip.presence || "Untitled"
  end

  private


  def set_default_data
    self.data ||= default_presentation_data
  end

  def default_presentation_data
    {
      slides: [
        {
          id: "slide-1",
          layout: "title",
          background: { color: "#FFFFFF" },
          elements: [
            {
              id: "elem-1",
              type: "text",
              content: "Click to add title",
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.5,
              options: {
                fontSize: 44,
                fontFace: "Arial",
                bold: true,
                color: "363636",
                align: "center"
              }
            },
            {
              id: "elem-2",
              type: "text",
              content: "Click to add subtitle",
              x: 0.5,
              y: 4,
              w: 9,
              h: 1,
              options: {
                fontSize: 24,
                fontFace: "Arial",
                color: "666666",
                align: "center"
              }
            }
          ],
          notes: ""
        }
      ],
      theme: {
        name: "default",
        colors: {
          primary: "#0066CC",
          secondary: "#333333",
          accent: "#FF6600",
          background: "#FFFFFF"
        }
      },
      metadata: {
        version: 1
      }
    }
  end
end
