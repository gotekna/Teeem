# EmailMailboxFavorite - Stores user's bookmarked/favorite mailboxes
#
# SSoT for which email accounts appear in the user's sidebar.
# Only favorited mailboxes are shown by default.
#
# Usage:
#   # Check if a mailbox is favorited
#   EmailMailboxFavorite.favorited?(user_id, account_id)
#
#   # Get all favorited account IDs for a user
#   EmailMailboxFavorite.favorited_account_ids(user_id)
#
#   # Toggle favorite status
#   EmailMailboxFavorite.toggle!(user_id, account_id)
#
class EmailMailboxFavorite < ApplicationRecord
  belongs_to :user

  validates :account_id, presence: true
  validates :account_id, uniqueness: { scope: :user_id }

  scope :for_user, ->(user_id) { where(user_id: user_id) }

  # Check if a mailbox is favorited by user
  def self.favorited?(user_id, account_id)
    exists?(user_id: user_id, account_id: account_id.to_s)
  end

  # Get all favorited account IDs for a user
  def self.favorited_account_ids(user_id)
    for_user(user_id).pluck(:account_id)
  end

  # Toggle favorite status - returns true if now favorited, false if unfavorited
  def self.toggle!(user_id, account_id)
    account_id = account_id.to_s
    existing = find_by(user_id: user_id, account_id: account_id)

    if existing
      existing.destroy!
      false
    else
      create!(user_id: user_id, account_id: account_id)
      true
    end
  end

  # Add a favorite (idempotent)
  def self.add!(user_id, account_id)
    find_or_create_by!(user_id: user_id, account_id: account_id.to_s)
    true
  end

  # Remove a favorite (idempotent)
  def self.remove!(user_id, account_id)
    where(user_id: user_id, account_id: account_id.to_s).destroy_all
    false
  end
end
