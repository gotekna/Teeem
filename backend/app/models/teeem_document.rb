# frozen_string_literal: true

class TeeemDocument < ApplicationRecord
  belongs_to :user
  belongs_to :job, optional: true

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
