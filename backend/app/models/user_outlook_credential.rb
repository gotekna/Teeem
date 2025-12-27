# frozen_string_literal: true

# DEPRECATED: Per-user Outlook credentials have been replaced by org-wide credentials
#
# This model exists solely for data migration purposes (migrate_microsoft_credentials_job.rb).
# The table user_outlook_credentials still exists in the database with legacy data.
#
# SSoT: All email sync now uses OrganizationMicrosoftAppCredential via OrgEmailSyncJob
#
# Do NOT use this model for new features. It will be removed after migration is complete.
class UserOutlookCredential < ApplicationRecord
  belongs_to :user

  # All attributes are read-only for migration purposes
  # access_token, refresh_token, expires_at, tenant_id, email
end
