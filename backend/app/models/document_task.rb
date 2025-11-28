class DocumentTask < ApplicationRecord
  belongs_to :job
  has_one_attached :document
  has_many :purchase_order_documents, dependent: :destroy
  has_many :purchase_orders, through: :purchase_order_documents

  validates :name, presence: true
  validates :category, presence: true
  validates :job_id, presence: true

  scope :for_category, ->(category) { where(category: category) }
  scope :required, -> { where(required: true) }
  scope :with_documents, -> { where(has_document: true) }
  scope :validated, -> { where(is_validated: true) }

  def document_url
    document.attached? ? Rails.application.routes.url_helpers.url_for(document) : nil
  end
end
