# frozen_string_literal: true

class TaskActionItem < ApplicationRecord
  belongs_to :sm_task
  belongs_to :checked_by, class_name: 'User', optional: true

  validates :text, presence: true

  default_scope { order(:position) }

  # Toggle the checked state
  def toggle!(user)
    if checked
      update!(checked: false, checked_by: nil, checked_at: nil)
    else
      update!(checked: true, checked_by: user, checked_at: Time.current)
    end
  end
end
