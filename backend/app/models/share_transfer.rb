class ShareTransfer < ApplicationRecord
  # Associations
  belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
  belongs_to :from_shareholder, class_name: "Contact", optional: true  # nil for new issues
  belongs_to :to_shareholder, class_name: "Contact"

  # Validations
  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :transfer_date, presence: true
  validates :share_class, presence: true

  # Scopes
  scope :by_date, -> { order(transfer_date: :desc) }
  scope :recent, -> { by_date.limit(10) }
  scope :for_shareholder, ->(contact_id) {
    where("from_shareholder_id = ? OR to_shareholder_id = ?", contact_id, contact_id)
  }

  # Check if this is a new share issue (no from_shareholder)
  def new_issue?
    from_shareholder_id.nil?
  end

  def from_shareholder_name
    from_shareholder&.display_name || "New Issue"
  end

  def to_shareholder_name
    to_shareholder&.display_name
  end
end
