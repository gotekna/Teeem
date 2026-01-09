# CaseJob - links jobs to cases
class CaseJob < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  belongs_to :job

  validates :case_id, uniqueness: { scope: :job_id }
  validates :relevance, inclusion: {
    in: %w[direct indirect reference],
    allow_blank: true
  }

  scope :direct, -> { where(relevance: "direct") }
  scope :by_relevance, ->(rel) { where(relevance: rel) }

  RELEVANCE_TYPES = {
    "direct" => "Directly Related",
    "indirect" => "Indirectly Related",
    "reference" => "Reference Only"
  }.freeze

  def formatted_relevance
    RELEVANCE_TYPES[relevance] || relevance&.titleize
  end
end
