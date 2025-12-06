class CaseEmailQa < ApplicationRecord
  # Associations
  belongs_to :case, class_name: "CaseRecord"
  belongs_to :case_email, optional: true
  belongs_to :email_warehouse, class_name: "EmailWarehouse", optional: true

  # Validations
  validates :question, presence: true
  validates :category, inclusion: {
    in: %w[deadline document_request clarification action_item follow_up other],
    allow_blank: true
  }

  # Scopes
  scope :for_case, ->(case_id) { where(case_id: case_id) }
  scope :unanswered, -> { where(is_answered: false) }
  scope :answered, -> { where(is_answered: true) }
  scope :important, -> { where(is_important: true) }
  scope :by_category, ->(category) { where(category: category) }
  scope :recent_first, -> { order(question_date: :desc) }
  scope :oldest_first, -> { order(question_date: :asc) }

  # Callbacks
  after_save :update_case_unanswered_count, if: :saved_change_to_is_answered?

  # Instance methods

  def mark_answered!(answer_text, answered_by: nil, answer_date: nil)
    update!(
      answer: answer_text,
      answer_from: answered_by,
      answer_date: answer_date || Time.current,
      is_answered: true
    )
  end

  def mark_important!
    update!(is_important: true)
  end

  def mark_unimportant!
    update!(is_important: false)
  end

  def display_question_from
    question_from.presence || email_warehouse&.from_name || email_warehouse&.from_email || "Unknown"
  end

  def display_answer_from
    answer_from.presence || "Unknown"
  end

  private

  def update_case_unanswered_count
    return unless self.case.present?

    count = self.case.case_email_qas.unanswered.count
    self.case.update_column(:unanswered_questions_count, count)
  end
end
