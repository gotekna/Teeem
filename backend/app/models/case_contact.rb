# CaseContact - links contacts to cases
class CaseContact < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: 'CaseRecord'
  belongs_to :contact

  validates :case_id, uniqueness: { scope: :contact_id }
  validates :role, inclusion: {
    in: %w[subject witness advisor opposing_party related_party],
    allow_blank: true
  }

  scope :primary, -> { where(is_primary: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :subjects, -> { where(role: 'subject') }

  ROLES = {
    'subject' => 'Subject of Investigation',
    'witness' => 'Witness',
    'advisor' => 'Advisor',
    'opposing_party' => 'Opposing Party',
    'related_party' => 'Related Party'
  }.freeze

  def formatted_role
    ROLES[role] || role&.titleize
  end
end
