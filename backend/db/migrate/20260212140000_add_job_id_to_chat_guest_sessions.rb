# frozen_string_literal: true

# Link guest chat sessions to jobs so client conversations
# appear in the job's Communications page.
#
# Flow: Host invites client from Job > Coms > Chat → creates session with job_id
# Guest messages auto-get job_id → appear in EntityChat via for_job scope
class AddJobIdToChatGuestSessions < ActiveRecord::Migration[7.1]
  def change
    add_reference :chat_guest_sessions, :job, foreign_key: true, null: true
  end
end
