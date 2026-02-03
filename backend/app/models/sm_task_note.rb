# frozen_string_literal: true

# SmTaskNote - Notes attached to SM Tasks
#
# Each note tracks who added it and when.
# Notes are displayed with latest first.
#
class SmTaskNote < ApplicationRecord
  belongs_to :sm_task
  belongs_to :user

  validates :content, presence: true

  # Default scope: latest notes first
  default_scope { order(created_at: :desc) }

  # For API serialization
  def as_json_with_user
    {
      id: id,
      content: content,
      created_at: created_at,
      user: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url
      }
    }
  end
end
