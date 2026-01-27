# frozen_string_literal: true

# Consolidate duplicate SyncedEmail records
#
# Before Ultra Email Architecture (Jan 2026), same email sent to multiple recipients
# was stored as MULTIPLE SyncedEmail records (one per mailbox). This wastes space
# and creates confusion.
#
# This task consolidates duplicates:
# 1. Groups emails by internet_message_id
# 2. Keeps ONE record per unique email
# 3. Creates mailbox_appearances for all recipients
# 4. Moves job assignments to the kept record
# 5. Deletes the duplicates
#
# Usage:
#   rails email:consolidate:preview     # Dry run - show what would be consolidated
#   rails email:consolidate:run         # Actually consolidate (with confirmation)
#   rails email:consolidate:run[force]  # Skip confirmation
#
namespace :email do
  namespace :consolidate do
    desc "Preview duplicate emails that would be consolidated (dry run)"
    task preview: :environment do
      puts "🔍 Scanning for duplicate emails by internet_message_id..."
      puts ""

      # Find all internet_message_ids with more than one record
      duplicates = SyncedEmail.unscoped
        .where.not(internet_message_id: [nil, ''])
        .group(:internet_message_id)
        .having('COUNT(*) > 1')
        .count

      if duplicates.empty?
        puts "✅ No duplicates found! All emails are unique by internet_message_id."
        next
      end

      total_duplicates = duplicates.values.sum
      unique_emails = duplicates.keys.count
      records_to_delete = total_duplicates - unique_emails

      puts "📊 Duplicate Analysis:"
      puts "   #{unique_emails} unique emails with duplicates"
      puts "   #{total_duplicates} total duplicate records"
      puts "   #{records_to_delete} records would be deleted (keeping 1 per email)"
      puts ""

      # Show top 10 examples
      puts "📋 Top 10 duplicates (by count):"
      puts "-" * 80

      duplicates.sort_by { |_, count| -count }.first(10).each do |message_id, count|
        emails = SyncedEmail.unscoped.where(internet_message_id: message_id).order(:created_at)
        first = emails.first
        mailboxes = emails.pluck(:mailbox_owner_email).compact.uniq

        puts "  #{count}x: #{first.subject&.truncate(50)}"
        puts "      message_id: #{message_id.truncate(60)}"
        puts "      mailboxes: #{mailboxes.join(', ')}"
        puts "      job_ids: #{emails.pluck(:job_id).compact.uniq.join(', ') || 'none'}"
        puts ""
      end

      puts "-" * 80
      puts ""
      puts "Run 'rails email:consolidate:run' to consolidate these duplicates."
      puts "This will:"
      puts "  1. Keep the oldest record for each unique email"
      puts "  2. Create mailbox_appearances for all recipients"
      puts "  3. Move job assignments to the kept record"
      puts "  4. Delete #{records_to_delete} duplicate records"
    end

    desc "Consolidate duplicate emails (run with [force] to skip confirmation)"
    task :run, [:force] => :environment do |_, args|
      force = args[:force] == 'force'

      puts "🔄 Consolidating duplicate emails..."
      puts ""

      # Find all internet_message_ids with more than one record
      duplicates = SyncedEmail.unscoped
        .where.not(internet_message_id: [nil, ''])
        .group(:internet_message_id)
        .having('COUNT(*) > 1')
        .pluck(:internet_message_id)

      if duplicates.empty?
        puts "✅ No duplicates found!"
        next
      end

      total_duplicates = SyncedEmail.unscoped.where(internet_message_id: duplicates).count
      records_to_delete = total_duplicates - duplicates.count

      puts "📊 Found #{duplicates.count} unique emails with #{total_duplicates} total records"
      puts "   Will delete #{records_to_delete} duplicate records"
      puts ""

      unless force
        print "Continue? (yes/no): "
        response = STDIN.gets&.strip&.downcase
        unless response == 'yes'
          puts "Aborted."
          next
        end
      end

      consolidated = 0
      deleted = 0
      errors = []

      duplicates.each_with_index do |message_id, index|
        begin
          ActiveRecord::Base.transaction do
            emails = SyncedEmail.unscoped
              .where(internet_message_id: message_id)
              .order(:created_at)
              .to_a

            # Keep the first (oldest) record
            keeper = emails.shift
            duplicates_to_delete = emails

            # Collect all unique mailboxes from duplicates (MS365 + IMAP)
            all_mailboxes = ([keeper] + duplicates_to_delete).map do |email|
              {
                mailbox_owner_email: email.mailbox_owner_email,
                outlook_id: email.outlook_id,
                uid: email.uid,  # IMAP message UID
                folder_name: email.folder_name,
                is_read: email.is_read,
                microsoft_credential_id: email.microsoft_credential_id,
                imap_credential_id: email.imap_credential_id
              }
            end.compact.uniq { |m| m[:mailbox_owner_email]&.downcase }

            # Create mailbox appearances for all mailboxes (MS365 + IMAP)
            all_mailboxes.each do |mailbox_data|
              next if mailbox_data[:mailbox_owner_email].blank?

              keeper.mailbox_appearances.find_or_create_by!(
                mailbox_owner_email: mailbox_data[:mailbox_owner_email].downcase
              ) do |appearance|
                appearance.outlook_id = mailbox_data[:outlook_id]
                appearance.uid = mailbox_data[:uid]
                appearance.folder_name = mailbox_data[:folder_name]
                appearance.is_read = mailbox_data[:is_read] || false
                appearance.microsoft_credential_id = mailbox_data[:microsoft_credential_id]
                appearance.imap_credential_id = mailbox_data[:imap_credential_id]
              end
            end

            # Move job assignments to keeper
            duplicates_to_delete.each do |dup|
              if dup.job_id.present? && keeper.job_id.nil?
                keeper.update!(
                  job_id: dup.job_id,
                  match_type: dup.match_type,
                  match_confidence: dup.match_confidence,
                  matched_at: dup.matched_at
                )
              end
            end

            # Move contact links to keeper
            duplicates_to_delete.each do |dup|
              if dup.contact_ids.present?
                keeper_contacts = keeper.contact_ids || []
                new_contacts = (keeper_contacts + dup.contact_ids).uniq
                keeper.update!(contact_ids: new_contacts) if new_contacts != keeper_contacts
              end

              if dup.primary_contact_id.present? && keeper.primary_contact_id.nil?
                keeper.update!(primary_contact_id: dup.primary_contact_id)
              end
            end

            # Transfer any warehouse documents to keeper
            duplicates_to_delete.each do |dup|
              dup.warehouse_document&.update!(documentable: keeper)
            end

            # Transfer email attachments to keeper
            duplicates_to_delete.each do |dup|
              dup.email_attachments.update_all(synced_email_id: keeper.id)
            end

            # Delete duplicates
            deleted_count = duplicates_to_delete.count
            duplicates_to_delete.each(&:destroy!)

            consolidated += 1
            deleted += deleted_count
          end

          # Progress update every 100
          if (index + 1) % 100 == 0
            puts "  Progress: #{index + 1}/#{duplicates.count} emails consolidated (#{deleted} records deleted)"
          end

        rescue => e
          errors << { message_id: message_id, error: e.message }
          puts "  ❌ Error consolidating #{message_id}: #{e.message}"
        end
      end

      puts ""
      puts "=" * 60
      puts "✅ Consolidation complete!"
      puts "   #{consolidated} unique emails consolidated"
      puts "   #{deleted} duplicate records deleted"
      puts "   #{errors.count} errors" if errors.any?
      puts "=" * 60

      if errors.any?
        puts ""
        puts "Errors:"
        errors.first(10).each do |err|
          puts "  - #{err[:message_id]}: #{err[:error]}"
        end
        puts "  ... and #{errors.count - 10} more" if errors.count > 10
      end
    end

    desc "Show statistics about email deduplication"
    task stats: :environment do
      puts "📊 Email Deduplication Statistics"
      puts "=" * 60

      total_emails = SyncedEmail.unscoped.count
      with_message_id = SyncedEmail.unscoped.where.not(internet_message_id: [nil, '']).count
      without_message_id = total_emails - with_message_id

      unique_message_ids = SyncedEmail.unscoped
        .where.not(internet_message_id: [nil, ''])
        .distinct
        .count(:internet_message_id)

      duplicates = with_message_id - unique_message_ids

      mailbox_appearances = SyncedEmailMailbox.count

      puts "Total SyncedEmail records:     #{total_emails}"
      puts "With internet_message_id:      #{with_message_id}"
      puts "Without internet_message_id:   #{without_message_id}"
      puts "Unique internet_message_ids:   #{unique_message_ids}"
      puts "Duplicate records:             #{duplicates}"
      puts "Mailbox appearances:           #{mailbox_appearances}"
      puts ""

      if duplicates > 0
        puts "⚠️  #{duplicates} duplicate records could be consolidated"
        puts "   Run: rails email:consolidate:preview"
      else
        puts "✅ No duplicates - all emails are unique!"
      end
    end
  end
end
