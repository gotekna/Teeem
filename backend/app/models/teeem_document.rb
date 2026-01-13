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

  # ========================================
  # Warehouse Path (SSoT: StorageConfiguration)
  # ========================================

  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}.html".gsub(%r{/+}, "/")
  end

  def warehouse_folder_path
    config = StorageConfiguration.instance

    if job.present?
      # SSoT: StorageConfiguration.path_for(:job) + template_for(:job)
      base = config.path_for(:job)
      template = config.template_for(:job)
      resolved = resolve_template(template, {
        "JobCode" => job.job_code,
        "TabName" => "Word"
      })
      "#{base}/#{resolved}".gsub(%r{/+}, "/")
    else
      # SSoT: StorageConfiguration.path_for(:word_documents) + template
      base = config.path_for(:word_documents)
      template = config.template_for(:word_documents)
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
