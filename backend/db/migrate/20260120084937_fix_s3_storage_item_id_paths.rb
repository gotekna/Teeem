# frozen_string_literal: true

# Migration to fix two related issues:
#
# 1. StorageConfiguration.scope_root_folders had wrong values with template placeholders
#    e.g., "Jobs/{{JobName}}" instead of just "Jobs"
#    This caused job_path() to return unresolved paths
#
# 2. JobDocument.storage_item_id was set with wrong format during sync
#    e.g., "jobs/46/photo/..." instead of "Jobs/J46/photo/..."
#    because build_job_folder_path used the broken scope_root_folders
#
# After this migration:
# - scope_root_folders will have simple base folders (e.g., "Jobs", "Contacts")
# - job documents will have correct S3 keys matching actual files
#
class FixS3StorageItemIdPaths < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Fix StorageConfiguration.scope_root_folders
    fix_storage_configuration

    # Step 2: Fix JobDocument.storage_item_id paths
    fix_job_document_paths
  end

  def down
    Rails.logger.warn "[FixS3Paths] Reverse migration not implemented - old values were incorrect"
  end

  private

  def fix_storage_configuration
    sc = StorageConfiguration.first
    return unless sc

    correct_folders = {
      "job" => "Jobs",
      "task" => "Tasks",
      "email" => "Emails",
      "people" => "People",
      "contact" => "Contacts",
      "warehouse" => "Warehousing",
      "corporate_entity" => "Corporate"
    }

    Rails.logger.info "[FixS3Paths] Fixing scope_root_folders"
    Rails.logger.info "[FixS3Paths]   Old: #{sc.scope_root_folders.inspect}"
    sc.update!(scope_root_folders: correct_folders)
    Rails.logger.info "[FixS3Paths]   New: #{sc.scope_root_folders.inspect}"
  end

  def fix_job_document_paths
    # Find all S3 JobDocuments with wrong format (lowercase jobs/)
    wrong_docs = JobDocument.where(storage_provider: 's3_compatible')
                           .where("storage_item_id LIKE 'jobs/%'")

    Rails.logger.info "[FixS3Paths] Found #{wrong_docs.count} documents to fix"

    fixed_count = 0
    wrong_docs.find_each do |doc|
      old_path = doc.storage_item_id
      next unless old_path.present?

      # Extract job_id from path: "jobs/46/photo/..." -> 46
      match = old_path.match(%r{^jobs/(\d+)/(.*)$})
      next unless match

      job_id = match[1].to_i
      rest_of_path = match[2]

      # Get job_code from database
      job = Job.find_by(id: job_id)
      unless job
        Rails.logger.warn "[FixS3Paths] Job #{job_id} not found for document #{doc.id}"
        next
      end

      # Build correct path: "Jobs/J46/photo/..."
      new_path = "Jobs/#{job.job_code}/#{rest_of_path}"

      # Update the document
      doc.update_columns(
        storage_item_id: new_path,
        storage_path: new_path
      )

      Rails.logger.info "[FixS3Paths] Fixed #{doc.id}: #{old_path} -> #{new_path}"
      fixed_count += 1
    end

    Rails.logger.info "[FixS3Paths] Fixed #{fixed_count} documents"
  end
end
