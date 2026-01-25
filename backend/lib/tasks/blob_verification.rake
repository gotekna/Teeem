# frozen_string_literal: true

namespace :blob do
  desc "Verify storage blobs exist in S3 and mark verified_at"
  task verify: :environment do |_t, args|
    require "aws-sdk-s3"

    # Set tenant context (required for StorageConfiguration)
    # Use Tekna tenant which has S3 storage configured
    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "No tenant found"
      exit 1
    end
    ActsAsTenant.current_tenant = tenant
    puts "Using tenant: #{tenant.name}"

    credential = S3CompatibleCredential.active.first
    unless credential
      puts "No S3 credential found"
      exit 1
    end

    bucket = StorageConfiguration.bucket
    unless bucket
      puts "No bucket configured in StorageConfiguration"
      exit 1
    end

    client = Aws::S3::Client.new(
      access_key_id: credential.access_key_id,
      secret_access_key: credential.secret_access_key,
      region: credential.region,
      endpoint: credential.endpoint,
      force_path_style: true
    )

    puts "Building list of files in bucket: #{bucket}..."
    existing_keys = Set.new
    token = nil
    loop do
      resp = client.list_objects_v2(bucket: bucket, max_keys: 1000, continuation_token: token)
      resp.contents.each { |obj| existing_keys << obj.key }
      print "\r  Found #{existing_keys.size} files..."
      break unless resp.is_truncated
      token = resp.next_continuation_token
    end
    puts "\n  Total: #{existing_keys.size} files in bucket"

    puts ""
    puts "Marking blobs as verified..."
    unverified = StorageBlob.unverified.where.not(storage_path: nil)
    total = unverified.count
    verified_count = 0
    missing_count = 0

    unverified.find_each.with_index do |blob, idx|
      key = blob.storage_path
      if existing_keys.include?(key)
        blob.mark_verified!
        verified_count += 1
      else
        missing_count += 1
      end
      print "\r  Processed #{idx + 1}/#{total} (#{verified_count} verified, #{missing_count} missing)..." if (idx + 1) % 100 == 0
    end

    puts ""
    puts "=" * 50
    puts "VERIFICATION COMPLETE"
    puts "=" * 50
    puts "Verified: #{verified_count}"
    puts "Missing:  #{missing_count}"
    puts "Total:    #{total}"
  end
end
