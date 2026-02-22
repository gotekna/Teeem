# frozen_string_literal: true

# Individual message within an AssistantConversation
# Supports user messages, assistant responses, and tool call/result pairs
#
class AssistantMessage < ApplicationRecord
  belongs_to :assistant_conversation

  ROLES = %w[user assistant tool_result].freeze
  CONTENT_TYPES = %w[text voice_transcript tool_use].freeze

  validates :role, inclusion: { in: ROLES }
  validates :content_type, inclusion: { in: CONTENT_TYPES }

  scope :chronological, -> { order(created_at: :asc) }
end
