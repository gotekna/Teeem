# frozen_string_literal: true

# Fix: Emails scope was incorrectly pointing to "Blobs" instead of "Emails"
#
# Root Cause Analysis (FRC):
# The `emails` scope folder was incorrectly set to "Blobs" in the database.
# This caused document browsing paths to resolve to /Blobs/mailbox/... instead
# of /Emails/mailbox/..., breaking the virtual file warehouse email browsing.
#
# The Blobs folder is for content-addressed deduplicated storage, not for browsing.
#
# Fix: Set emails scope to "Emails" to match the email scope.
class FixEmailsScopeFolder < ActiveRecord::Migration[7.1]
  def up
    StorageConfiguration.find_each do |config|
      folders = config.scope_folders || {}

      # Only fix if emails is incorrectly set to Blobs
      if folders["emails"] == "Blobs"
        folders["emails"] = "Emails"
        config.update!(scope_folders: folders)
        puts "Fixed emails scope folder for StorageConfiguration #{config.id}: Blobs -> Emails"
      elsif folders["emails"].nil?
        # If emails scope doesn't exist, add it for consistency
        folders["emails"] = "Emails"
        config.update!(scope_folders: folders)
        puts "Added emails scope folder for StorageConfiguration #{config.id}: Emails"
      else
        puts "StorageConfiguration #{config.id} emails scope is already: #{folders['emails']}"
      end
    end
  end

  def down
    # This migration fixes incorrect data, no rollback needed
    # Rolling back would reintroduce the bug
  end
end
