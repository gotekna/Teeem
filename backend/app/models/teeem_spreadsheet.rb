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
