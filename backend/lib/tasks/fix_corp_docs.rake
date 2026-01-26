namespace :fix do
  desc "Fix corporate docs missing storage_blob_id"
  task corp_docs: :environment do
    puts "FIXING CORPORATE DOCS"
    fixed = 0

    CorporateCompanyDocument.where(storage_blob_id: nil).find_each do |doc|
      next unless doc.file_name.present?

      # Find most recent matching blob
      blob = StorageBlob.where(original_filename: doc.file_name).order(created_at: :desc).first

      if blob
        doc.update_columns(storage_blob_id: blob.id, storage_path: blob.storage_path)
        blob.increment!(:reference_count)
        puts "Fixed #{doc.id}: #{doc.file_name} -> blob #{blob.id}"
        fixed += 1
      else
        puts "No blob for #{doc.id}: #{doc.file_name}"
      end
    end

    puts ""
    puts "Fixed: #{fixed} docs"
  end

  desc "Queue email upload job"
  task emails: :environment do
    # SSoT: Use tenant 2 (Tekna) - all emails are in this tenant
    tenant = Tenant.find(2)
    raise "No tenant found" unless tenant

    ActsAsTenant.with_tenant(tenant) do
      can_migrate = SyncedEmail
        .where(storage_path: [nil, ''])
        .where.not(outlook_id: [nil, ''])
        .where.not(mailbox_owner_email: [nil, ''])
        .count

      puts "Emails that can be migrated: #{can_migrate}"

      if can_migrate > 0
        UploadEmailsToStorageJob.perform_later(batch_size: 2000, tenant_id: tenant.id)
        puts "Job queued for tenant #{tenant.id}! Check BackgroundJobProgress for status."
      else
        puts 'No emails to migrate.'
      end
    end
  end
end
