# EmailFolderPreference - Stores user's custom folder ordering per email account
#
# SSoT for folder display order in the email sidebar.
# When a user drags to reorder folders, their preference is saved here.
#
# Usage:
#   # Get ordered folder IDs for a user's account
#   EmailFolderPreference.ordered_folder_ids(user_id, account_id)
#
#   # Save folder order after drag-drop
#   EmailFolderPreference.save_order(user_id, account_id, folder_ids)
#
class EmailFolderPreference < ApplicationRecord
  belongs_to :user

  validates :account_id, presence: true
  validates :folder_id, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :folder_id, uniqueness: { scope: [:user_id, :account_id] }

  scope :for_account, ->(user_id, account_id) {
    where(user_id: user_id, account_id: account_id).order(:position)
  }

  # Get ordered folder IDs for a user's email account
  # Returns array of folder_ids in user's preferred order
  def self.ordered_folder_ids(user_id, account_id)
    for_account(user_id, account_id).pluck(:folder_id)
  end

  # Save folder order after user drag-drop reorder
  # folder_ids: Array of folder IDs in new order
  def self.save_order(user_id, account_id, folder_ids)
    return if folder_ids.blank?

    # Normalize: convert to strings and remove duplicates (keep first occurrence)
    unique_folder_ids = folder_ids.map(&:to_s).uniq

    transaction do
      # Delete existing preferences for this account
      where(user_id: user_id, account_id: account_id).delete_all

      # Insert new order
      unique_folder_ids.each_with_index do |folder_id, position|
        create!(
          user_id: user_id,
          account_id: account_id,
          folder_id: folder_id,
          position: position
        )
      end
    end
  end

  # Apply custom order to folders array
  # Returns folders sorted by user preference (unordered folders go to end)
  def self.apply_order(user_id, account_id, folders)
    ordered_ids = ordered_folder_ids(user_id, account_id)
    return folders if ordered_ids.empty?

    # Create position map
    position_map = ordered_ids.each_with_index.to_h

    # Sort folders: known positions first, then others at end
    folders.sort_by do |folder|
      folder_id = folder.is_a?(Hash) ? (folder[:id] || folder["id"]) : folder.id
      position_map[folder_id.to_s] || (position_map.size + 1000)
    end
  end
end
