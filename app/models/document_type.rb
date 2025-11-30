class DocumentType < ApplicationRecord
  # Associations
  has_many :company_documents, dependent: :nullify

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :category, inclusion: { in: %w[corporate tax compliance general financial company trust advice registry insurance asic ato bank assets dividends loans minutes], allow_blank: true }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_category, ->(category) { where(category: category) }
  scope :requiring_filing, -> { where(requires_filing: true) }

  def display_name
    name
  end

  # Group document types by folder
  def self.grouped_by_folder
    active.order(:folder, :name).group_by(&:folder)
  end
end
