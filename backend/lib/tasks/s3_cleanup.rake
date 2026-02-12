# frozen_string_literal: true

namespace :s3 do
  desc "Queue all S3 documents for path cleanup (rename to clean URLs)"
  task cleanup_paths: :environment do
    count = S3PathCleanupJob.rename_all_old_paths!
    puts "Queued #{count} documents for S3 path cleanup"
  end

  desc "Configure CORS on S3 bucket to allow direct browser uploads"
  task configure_cors: :environment do
    org = Organization.first
    unless org
      puts "No organization found"
      exit 1
    end

    provider = DocumentProviders::S3Compatible.for_organization(org)
    provider.configure_cors!
    puts "CORS configured successfully for bucket"
  end
end
