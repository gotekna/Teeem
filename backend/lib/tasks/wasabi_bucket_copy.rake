# frozen_string_literal: true

# Wasabi Bucket Copy - Copy files between Wasabi buckets
#
# Background:
#   AWS CLI is not installed, so we use the AWS SDK directly.
#   This task copies ALL files from source bucket to destination bucket
#   using S3's server-side copy (no download/upload needed).
#
# Usage:
#   # Preview what will be copied
#   rails wasabi:copy_bucket[source-bucket,teeem-tekna]
#
#   # Execute the copy
#   rails wasabi:copy_bucket[source-bucket,teeem-tekna,execute]
#
#   # List files in a bucket
#   rails wasabi:list_bucket[source-bucket]
#
namespace :wasabi do
  desc "Copy all files from one Wasabi bucket to another"
  task :copy_bucket, [:source_bucket, :dest_bucket, :execute] => :environment do |_t, args|
    source_bucket = args[:source_bucket]
    dest_bucket = args[:dest_bucket]
    execute = args[:execute] == "execute"

    unless source_bucket.present? && dest_bucket.present?
      puts "Usage: rails wasabi:copy_bucket[source_bucket,dest_bucket,execute]"
      puts ""
      puts "Example:"
      puts "  rails wasabi:copy_bucket[source-bucket,teeem-tekna]          # Preview"
      puts "  rails wasabi:copy_bucket[source-bucket,teeem-tekna,execute]  # Execute"
      exit 1
    end

    puts "=" * 70
    puts "WASABI BUCKET COPY"
    puts "=" * 70
    puts ""
    puts "Source:      #{source_bucket}"
    puts "Destination: #{dest_bucket}"
    puts "Mode:        #{execute ? 'EXECUTE' : 'PREVIEW (dry run)'}"
    puts ""

    # Get active S3 credential
    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    puts "Using credential: #{credential.id} (#{credential.endpoint})"
    puts ""

    # Build source and destination clients
    source_client = build_client_for_bucket(credential, source_bucket)
    dest_client = build_client_for_bucket(credential, dest_bucket)

    # Verify both buckets exist
    begin
      source_client.head_bucket(bucket: source_bucket)
      puts "Source bucket verified: #{source_bucket}"
    rescue Aws::S3::Errors::NotFound
      puts "ERROR: Source bucket not found: #{source_bucket}"
      exit 1
    rescue Aws::S3::Errors::Forbidden
      puts "ERROR: Access denied to source bucket: #{source_bucket}"
      exit 1
    end

    begin
      dest_client.head_bucket(bucket: dest_bucket)
      puts "Destination bucket verified: #{dest_bucket}"
    rescue Aws::S3::Errors::NotFound
      puts "ERROR: Destination bucket not found: #{dest_bucket}"
      exit 1
    rescue Aws::S3::Errors::Forbidden
      puts "ERROR: Access denied to destination bucket: #{dest_bucket}"
      exit 1
    end

    puts ""

    # Count objects in source bucket
    total_objects = count_objects(source_client, source_bucket)
    total_size_bytes = calculate_total_size(source_client, source_bucket)

    puts "Source bucket stats:"
    puts "  Objects: #{total_objects}"
    puts "  Total size: #{format_size(total_size_bytes)}"
    puts ""

    unless execute
      puts "This is a PREVIEW. To execute, run:"
      puts "  rails wasabi:copy_bucket[#{source_bucket},#{dest_bucket},execute]"
      puts ""
      puts "Sample files (first 20):"
      sample_objects(source_client, source_bucket, 20).each do |obj|
        puts "  #{obj[:key]} (#{format_size(obj[:size])})"
      end
      exit 0
    end

    # Execute the copy
    puts "Starting copy..."
    puts ""

    stats = { copied: 0, skipped: 0, errors: [] }
    continuation_token = nil
    batch_num = 0

    loop do
      batch_num += 1
      params = { bucket: source_bucket, max_keys: 1000 }
      params[:continuation_token] = continuation_token if continuation_token

      response = source_client.list_objects_v2(params)
      objects = response.contents || []

      objects.each do |obj|
        key = obj.key
        size = obj.size

        # Skip empty folder markers
        next if key.end_with?("/") && size == 0

        begin
          # Copy object using server-side copy
          dest_client.copy_object(
            bucket: dest_bucket,
            key: key,
            copy_source: "#{source_bucket}/#{URI.encode_www_form_component(key)}"
          )

          stats[:copied] += 1
          print "." if stats[:copied] % 100 == 0
        rescue Aws::S3::Errors::ServiceError => e
          stats[:errors] << { key: key, error: e.message }
          print "E"
        end
      end

      break unless response.is_truncated
      continuation_token = response.next_continuation_token

      # Progress report every batch
      puts " [Batch #{batch_num}: #{stats[:copied]} copied]" if stats[:copied] % 1000 == 0
    end

    puts ""
    puts ""
    puts "=" * 70
    puts "COPY COMPLETE"
    puts "=" * 70
    puts "Copied:  #{stats[:copied]}"
    puts "Skipped: #{stats[:skipped]}"
    puts "Errors:  #{stats[:errors].count}"

    if stats[:errors].any?
      puts ""
      puts "Errors (first 10):"
      stats[:errors].first(10).each do |err|
        puts "  #{err[:key]}: #{err[:error]}"
      end
    end

    # Verify destination
    puts ""
    dest_count = count_objects(dest_client, dest_bucket)
    puts "Destination bucket now has #{dest_count} objects"

    if dest_count >= stats[:copied]
      puts "✓ Copy verified successfully"
    else
      puts "⚠ Warning: Destination count (#{dest_count}) < copied count (#{stats[:copied]})"
    end
  end

  desc "List files in a Wasabi bucket"
  task :list_bucket, [:bucket, :limit] => :environment do |_t, args|
    bucket = args[:bucket]
    limit = (args[:limit] || 100).to_i

    unless bucket.present?
      puts "Usage: rails wasabi:list_bucket[bucket_name,limit]"
      exit 1
    end

    puts "=" * 70
    puts "WASABI BUCKET CONTENTS: #{bucket}"
    puts "=" * 70
    puts ""

    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    client = build_client_for_bucket(credential, bucket)

    begin
      client.head_bucket(bucket: bucket)
    rescue Aws::S3::Errors::NotFound
      puts "ERROR: Bucket not found: #{bucket}"
      exit 1
    rescue Aws::S3::Errors::Forbidden
      puts "ERROR: Access denied: #{bucket}"
      exit 1
    end

    total = count_objects(client, bucket)
    total_size = calculate_total_size(client, bucket)

    puts "Total objects: #{total}"
    puts "Total size: #{format_size(total_size)}"
    puts ""
    puts "Files (first #{limit}):"

    sample_objects(client, bucket, limit).each do |obj|
      puts "  #{obj[:key]} (#{format_size(obj[:size])})"
    end

    puts ""
    puts "..." if total > limit
  end

  desc "Compare two Wasabi buckets"
  task :compare_buckets, [:bucket1, :bucket2] => :environment do |_t, args|
    bucket1 = args[:bucket1]
    bucket2 = args[:bucket2]

    unless bucket1.present? && bucket2.present?
      puts "Usage: rails wasabi:compare_buckets[bucket1,bucket2]"
      exit 1
    end

    puts "=" * 70
    puts "COMPARING BUCKETS"
    puts "=" * 70
    puts ""

    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    client1 = build_client_for_bucket(credential, bucket1)
    client2 = build_client_for_bucket(credential, bucket2)

    count1 = count_objects(client1, bucket1)
    count2 = count_objects(client2, bucket2)
    size1 = calculate_total_size(client1, bucket1)
    size2 = calculate_total_size(client2, bucket2)

    puts "#{bucket1}:"
    puts "  Objects: #{count1}"
    puts "  Size: #{format_size(size1)}"
    puts ""
    puts "#{bucket2}:"
    puts "  Objects: #{count2}"
    puts "  Size: #{format_size(size2)}"
    puts ""

    if count1 == count2 && size1 == size2
      puts "✓ Buckets appear identical"
    else
      puts "⚠ Buckets differ:"
      puts "  Object count: #{count1} vs #{count2} (diff: #{(count1 - count2).abs})"
      puts "  Total size: #{format_size(size1)} vs #{format_size(size2)}"
    end
  end

  private

  def build_client_for_bucket(credential, bucket)
    options = {
      access_key_id: credential.access_key_id,
      secret_access_key: credential.secret_access_key,
      region: credential.region
    }

    if credential.endpoint.present?
      options[:endpoint] = credential.endpoint
      options[:force_path_style] = true
    end

    Aws::S3::Client.new(options)
  end

  def count_objects(client, bucket)
    count = 0
    continuation_token = nil

    loop do
      params = { bucket: bucket, max_keys: 1000 }
      params[:continuation_token] = continuation_token if continuation_token

      response = client.list_objects_v2(params)
      count += (response.contents || []).count

      break unless response.is_truncated
      continuation_token = response.next_continuation_token
    end

    count
  end

  def calculate_total_size(client, bucket)
    total = 0
    continuation_token = nil

    loop do
      params = { bucket: bucket, max_keys: 1000 }
      params[:continuation_token] = continuation_token if continuation_token

      response = client.list_objects_v2(params)
      (response.contents || []).each { |obj| total += obj.size }

      break unless response.is_truncated
      continuation_token = response.next_continuation_token
    end

    total
  end

  def sample_objects(client, bucket, limit)
    objects = []
    continuation_token = nil

    loop do
      params = { bucket: bucket, max_keys: [limit, 1000].min }
      params[:continuation_token] = continuation_token if continuation_token

      response = client.list_objects_v2(params)
      (response.contents || []).each do |obj|
        objects << { key: obj.key, size: obj.size, modified: obj.last_modified }
        break if objects.count >= limit
      end

      break if objects.count >= limit
      break unless response.is_truncated
      continuation_token = response.next_continuation_token
    end

    objects
  end

  def format_size(bytes)
    return "0 B" if bytes.nil? || bytes == 0

    units = %w[B KB MB GB TB]
    exp = (Math.log(bytes) / Math.log(1024)).to_i
    exp = [exp, units.length - 1].min

    "%.2f %s" % [bytes.to_f / (1024**exp), units[exp]]
  end
end
