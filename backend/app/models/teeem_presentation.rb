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
