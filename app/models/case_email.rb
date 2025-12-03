# CaseEmail - links emails from warehouse to cases
class CaseEmail < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: 'CaseRecord'
  belongs_to :email_warehouse
  belongs_to :added_by, class_name: 'User', optional: true

  validates :case_id, uniqueness: { scope: :email_warehouse_id }
  validates :relevance, inclusion: {
    in: %w[key_evidence supporting background reference],
    allow_blank: true
  }

  scope :key_evidence, -> { where(relevance: 'key_evidence') }
  scope :by_relevance, -> { order(Arel.sql("CASE relevance WHEN 'key_evidence' THEN 1 WHEN 'supporting' THEN 2 WHEN 'background' THEN 3 ELSE 4 END")) }
  scope :by_sequence, -> { order(:sequence) }
  scope :by_date, -> { joins(:email_warehouse).order('email_warehouse.received_at DESC') }

  RELEVANCE_TYPES = {
    'key_evidence' => 'Key Evidence',
    'supporting' => 'Supporting',
    'background' => 'Background',
    'reference' => 'Reference'
  }.freeze

  def formatted_relevance
    RELEVANCE_TYPES[relevance] || relevance&.titleize
  end
end
