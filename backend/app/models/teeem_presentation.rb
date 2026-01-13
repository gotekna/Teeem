# frozen_string_literal: true

class TeeemPresentation < ApplicationRecord
  belongs_to :user
  belongs_to :job, optional: true

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
  # Warehouse Path (SSoT: StorageConfiguration)
  # ========================================

  def warehouse_path
    if job.present?
      "Jobs/#{job.job_code}/PowerPoint/#{safe_filename}.pptx".gsub(%r{/+}, "/")
    else
      config = StorageConfiguration.instance
      base = config.path_for(:powerpoint_documents)
      template = config.template_for(:powerpoint_documents)

      resolved = resolve_template(template, {
        "UserName" => user&.display_name || "Unknown",
        "Year" => created_at&.year&.to_s || Time.current.year.to_s
      })

      "#{base}/#{resolved}/#{safe_filename}.pptx".gsub(%r{/+}, "/")
    end
  end

  def warehouse_folder_path
    if job.present?
      "Jobs/#{job.job_code}/PowerPoint".gsub(%r{/+}, "/")
    else
      config = StorageConfiguration.instance
      base = config.path_for(:powerpoint_documents)
      template = config.template_for(:powerpoint_documents)

      resolved = resolve_template(template, {
        "UserName" => user&.display_name || "Unknown",
        "Year" => created_at&.year&.to_s || Time.current.year.to_s
      })

      "#{base}/#{resolved}".gsub(%r{/+}, "/")
    end
  end

  def safe_filename
    name.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip.presence || "Untitled"
  end

  private

  def resolve_template(template, values)
    result = template.dup
    values.each { |key, value| result.gsub!("{{#{key}}}", value.to_s) }
    result
  end


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
