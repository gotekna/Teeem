# CaseContact - links contacts to cases with relationship visualization
class CaseContact < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: 'CaseRecord'
  belongs_to :contact

  validates :case_id, uniqueness: { scope: :contact_id }
  validates :role, inclusion: {
    in: %w[subject witness advisor opposing_party related_party],
    allow_blank: true
  }
  validates :relationship_type, inclusion: {
    in: %w[client accountant lawyer previous_accountant advisor opposing_party witness related_party ato_officer director shareholder bank_manager insurer broker],
    allow_blank: true
  }

  scope :primary, -> { where(is_primary: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :by_relationship_type, ->(type) { where(relationship_type: type) }
  scope :subjects, -> { where(role: 'subject') }

  ROLES = {
    'subject' => 'Subject of Investigation',
    'witness' => 'Witness',
    'advisor' => 'Advisor',
    'opposing_party' => 'Opposing Party',
    'related_party' => 'Related Party'
  }.freeze

  # Relationship types for the visual chart - more granular than roles
  RELATIONSHIP_TYPES = {
    'client' => { name: 'Client', color: 'blue', icon: 'user' },
    'accountant' => { name: 'Accountant', color: 'green', icon: 'calculator' },
    'lawyer' => { name: 'Lawyer', color: 'purple', icon: 'scale' },
    'previous_accountant' => { name: 'Previous Accountant', color: 'emerald', icon: 'calculator' },
    'advisor' => { name: 'Advisor', color: 'teal', icon: 'lightbulb' },
    'opposing_party' => { name: 'Opposing Party', color: 'orange', icon: 'alert-triangle' },
    'witness' => { name: 'Witness', color: 'yellow', icon: 'eye' },
    'related_party' => { name: 'Related Party', color: 'gray', icon: 'users' },
    'ato_officer' => { name: 'ATO Officer', color: 'red', icon: 'landmark' },
    'director' => { name: 'Director', color: 'indigo', icon: 'briefcase' },
    'shareholder' => { name: 'Shareholder', color: 'pink', icon: 'pie-chart' },
    'bank_manager' => { name: 'Bank Manager', color: 'cyan', icon: 'building' },
    'insurer' => { name: 'Insurer', color: 'amber', icon: 'shield' },
    'broker' => { name: 'Broker', color: 'lime', icon: 'trending-up' }
  }.freeze

  def formatted_role
    ROLES[role] || role&.titleize
  end

  def formatted_relationship_type
    RELATIONSHIP_TYPES.dig(relationship_type, :name) || relationship_type&.titleize
  end

  def relationship_color
    RELATIONSHIP_TYPES.dig(relationship_type, :color) || 'gray'
  end

  def relationship_icon
    RELATIONSHIP_TYPES.dig(relationship_type, :icon) || 'user'
  end

  # For chart positioning
  def chart_position
    display_position.presence || { 'x' => 0, 'y' => 0 }
  end

  def update_chart_position!(x:, y:)
    update!(display_position: { 'x' => x, 'y' => y })
  end
end
