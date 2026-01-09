class EmailSyncStatus < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true

  enum :status, {
    pending: "pending",
    syncing: "syncing",
    completed: "completed",
    failed: "failed"
  }, default: :pending

  scope :needs_sync, -> {
    where(status: [ "pending", "completed" ])
      .where("last_sync_at IS NULL OR last_sync_at < ?", 10.minutes.ago)
  }

  def mark_syncing!
    update!(
      status: :syncing,
      sync_started_at: Time.current,
      emails_synced_this_run: 0,
      last_error: nil
    )
  end

  def mark_completed!(emails_count)
    update!(
      status: :completed,
      last_sync_at: Time.current,
      emails_synced_this_run: emails_count,
      total_emails_synced: total_emails_synced + emails_count,
      last_error: nil
    )
  end

  def mark_failed!(error_message)
    update!(
      status: :failed,
      last_error: error_message
    )
  end

  def sync_in_progress?
    syncing? && sync_started_at && sync_started_at > 30.minutes.ago
  end
end
