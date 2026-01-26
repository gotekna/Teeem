# frozen_string_literal: true

# Backup Storage Configuration
#
# Configures Backblaze B2 (or any S3-compatible service) for disaster recovery backups.
#
# Environment variables required:
#   BACKUP_S3_ENDPOINT:    S3 endpoint URL (e.g., https://s3.us-west-004.backblazeb2.com)
#   BACKUP_S3_BUCKET:      Bucket name (e.g., teeem-backups)
#   BACKUP_S3_ACCESS_KEY:  Access key ID
#   BACKUP_S3_SECRET_KEY:  Secret access key
#   BACKUP_S3_REGION:      Region (e.g., us-west-004) - defaults to us-west-004
#
# Setup instructions for Backblaze B2:
#   1. Create account at backblaze.com
#   2. Create a bucket named "teeem-backups" (or your preferred name)
#   3. Create an Application Key with read/write access to the bucket
#   4. Set environment variables in Heroku:
#
#   heroku config:set BACKUP_S3_ENDPOINT="https://s3.us-west-004.backblazeb2.com" --app teeem-production
#   heroku config:set BACKUP_S3_BUCKET="teeem-backups" --app teeem-production
#   heroku config:set BACKUP_S3_ACCESS_KEY="your-key-id" --app teeem-production
#   heroku config:set BACKUP_S3_SECRET_KEY="your-secret" --app teeem-production
#   heroku config:set BACKUP_S3_REGION="us-west-004" --app teeem-production
#
# Heroku Scheduler jobs (add via Heroku Dashboard):
#   00:00 UTC: heroku pg:backups:capture --app teeem-production
#   12:00 UTC: heroku pg:backups:capture --app teeem-production
#   02:00 UTC: rails runner "DocumentBackupJob.perform_now(:daily)"
#   Sunday 03:00 UTC: rails runner "DatabaseBackupJob.perform_now"
#   Sunday 04:00 UTC: rails runner "DocumentBackupJob.perform_now(:all)"
#
# Cost estimate for Backblaze B2:
#   Storage: $0.005/GB/month (~$5/TB)
#   Downloads: $0.01/GB
#   API calls: Free for most operations
#
# Log configuration status on boot (non-production environments only)
Rails.application.config.after_initialize do
  if Rails.env.development? || Rails.env.staging?
    if BackupStorageService.configured?
      Rails.logger.info "[BackupStorage] Configured with bucket: #{ENV['BACKUP_S3_BUCKET']}"
    else
      Rails.logger.info "[BackupStorage] Not configured - set BACKUP_S3_* environment variables"
    end
  end
end
