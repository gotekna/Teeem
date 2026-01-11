# frozen_string_literal: true

namespace :s3 do
  desc "Queue all S3 documents for path cleanup (rename to clean URLs)"
  task cleanup_paths: :environment do
    count = S3PathCleanupJob.rename_all_old_paths!
    puts "Queued #{count} documents for S3 path cleanup"
  end
end
