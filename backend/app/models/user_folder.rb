# frozen_string_literal: true

# UserFolder - Persists virtual folder paths for My Docs
#
# Folders are virtual (no physical storage entity) but need to persist
# so empty folders remain visible in the folder tree.
# When a document is the last one in a folder and is deleted or moved,
# the folder still appears until explicitly deleted.
#
class UserFolder < ApplicationRecord
  belongs_to :user, optional: true

  validates :path, presence: true
  validates :path, uniqueness: { scope: :user_id }

  scope :for_user, ->(user_id) { where(user_id: user_id) }
end
