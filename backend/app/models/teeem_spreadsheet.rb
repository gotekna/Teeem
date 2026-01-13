class TeeemSpreadsheet < ApplicationRecord
  belongs_to :user
  belongs_to :job, optional: true

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
  # Warehouse Path (for File Warehouse storage)
  # ========================================

  # Compute the warehouse path for this spreadsheet
  # SSoT: Uses StorageConfiguration for base path and template
  #
  def warehouse_path
    "#{warehouse_folder_path}/#{safe_filename}.xlsx".gsub(%r{/+}, "/")
  end

  # Folder path (without filename)
  def warehouse_folder_path
    config = StorageConfiguration.instance

    if job.present?
      # SSoT: StorageConfiguration.path_for(:job) + template_for(:job)
      base = config.path_for(:job)
      template = config.template_for(:job)
      resolved = resolve_template(template, {
        "JobCode" => job.job_code,
        "TabName" => "Excel"
      })
      "#{base}/#{resolved}".gsub(%r{/+}, "/")
    else
      # SSoT: StorageConfiguration.path_for(:excel_documents) + template
      base = config.path_for(:excel_documents)
      template = config.template_for(:excel_documents)
      resolved = resolve_template(template, {
        "UserName" => user&.display_name || "Unknown",
        "Year" => created_at&.year&.to_s || Time.current.year.to_s,
        "Month" => created_at&.strftime("%m") || Time.current.strftime("%m")
      })
      "#{base}/#{resolved}".gsub(%r{/+}, "/")
    end
  end

  # Safe filename (remove special characters)
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
