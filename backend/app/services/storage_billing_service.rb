# frozen_string_literal: true

# StorageBillingService - Calculates real storage usage and costs
#
# SSoT: THE ONE source for Wasabi/Backblaze storage cost data on the Architecture dashboard
#
# Wasabi: Uses S3CompatibleCredential (tenant-scoped) to list bucket objects
# Backblaze B2: Uses BackupStorageService (ENV-based) to list backup objects
#
# Pricing (as of Feb 2026):
#   Wasabi:      $6.99/TB/month, 1TB minimum, no egress fees
#   Backblaze:   $6.00/TB/month ($0.005/GB), first 10GB free, egress 3x storage free
#
class StorageBillingService
  CACHE_KEY = "storage_billing_data"
  CACHE_TTL = 1.hour

  # Wasabi pricing
  WASABI_RATE_PER_TB = 6.99
  WASABI_MIN_TB = 1.0  # 1TB minimum billing

  # Backblaze B2 pricing
  BACKBLAZE_RATE_PER_TB = 6.00
  BACKBLAZE_FREE_GB = 10.0

  class << self
    def billing(force_refresh: false)
      Rails.cache.delete(CACHE_KEY) if force_refresh

      cached = Rails.cache.read(CACHE_KEY)
      return cached.merge(cached: true) if cached

      result = fetch_billing
      Rails.cache.write(CACHE_KEY, result, expires_in: CACHE_TTL) if result[:success]
      result.merge(cached: false)
    rescue StandardError => e
      Rails.logger.error("[StorageBillingService] Error: #{e.message}")
      fallback = Rails.cache.read(CACHE_KEY)
      fallback ? fallback.merge(cached: true) : { success: false, error: e.message }
    end

    private

    def fetch_billing
      wasabi = fetch_wasabi_usage
      backblaze = fetch_backblaze_usage

      {
        success: true,
        wasabi: wasabi,
        backblaze: backblaze,
        fetchedAt: Time.current.iso8601
      }
    end

    def fetch_wasabi_usage
      provider = WarehouseProvider.instance
      return { success: false, error: "No storage provider configured" } unless provider&.connected?
      return { success: false, error: "Not S3-compatible provider" } unless provider.provider_type == "s3_compatible"

      credential_id = provider.storage_credential_id
      credential = if credential_id.present?
        S3CompatibleCredential.find_by(id: credential_id)
      else
        S3CompatibleCredential.active.connected.first
      end
      return { success: false, error: "No active Wasabi credential" } unless credential

      bucket = provider.bucket
      return { success: false, error: "Bucket not configured" } unless bucket.present?

      client = credential.build_client
      stats = calculate_bucket_stats(client, bucket)

      size_tb = stats[:total_bytes] / (1024.0**4)
      billable_tb = [size_tb, WASABI_MIN_TB].max
      estimated_cost = (billable_tb * WASABI_RATE_PER_TB).round(2)

      {
        success: true,
        provider: credential.provider_type || "wasabi",
        bucket: bucket,
        endpoint: credential.endpoint,
        totalBytes: stats[:total_bytes],
        totalObjects: stats[:total_objects],
        totalSizeGB: (stats[:total_bytes] / (1024.0**3)).round(2),
        totalSizeTB: size_tb.round(3),
        billableTB: billable_tb.round(3),
        estimatedCost: estimated_cost,
        ratePerTB: WASABI_RATE_PER_TB,
        minimumTB: WASABI_MIN_TB,
        sampled: stats[:sampled],
        byPrefix: stats[:by_prefix]
      }
    rescue StandardError => e
      Rails.logger.error("[StorageBillingService] Wasabi error: #{e.message}")
      { success: false, error: e.message }
    end

    def fetch_backblaze_usage
      return { success: false, error: "Backup storage not configured" } unless BackupStorageService.configured?

      stats = BackupStorageService.stats
      total_bytes = stats[:total_size]
      size_gb = total_bytes / (1024.0**3)
      size_tb = total_bytes / (1024.0**4)

      # Backblaze: first 10GB free, then $6/TB
      billable_gb = [size_gb - BACKBLAZE_FREE_GB, 0].max
      billable_tb = billable_gb / 1024.0
      estimated_cost = (billable_tb * BACKBLAZE_RATE_PER_TB).round(2)

      {
        success: true,
        provider: "backblaze_b2",
        bucket: ENV["BACKUP_S3_BUCKET"],
        totalBytes: total_bytes,
        totalObjects: stats[:object_count],
        totalSizeGB: size_gb.round(2),
        totalSizeTB: size_tb.round(3),
        billableTB: billable_tb.round(3),
        estimatedCost: estimated_cost,
        ratePerTB: BACKBLAZE_RATE_PER_TB,
        freeGB: BACKBLAZE_FREE_GB,
        byPrefix: stats[:by_prefix]&.transform_values do |v|
          {
            count: v[:count],
            sizeGB: (v[:size] / (1024.0**3)).round(2)
          }
        end
      }
    rescue StandardError => e
      Rails.logger.error("[StorageBillingService] Backblaze error: #{e.message}")
      { success: false, error: e.message }
    end

    def calculate_bucket_stats(client, bucket)
      total_bytes = 0
      total_objects = 0
      by_prefix = Hash.new { |h, k| h[k] = { count: 0, bytes: 0 } }
      continuation_token = nil
      sampled = false

      # Iterate through all objects (cap at 100 pages = 100k objects for safety)
      100.times do
        response = client.list_objects_v2(
          bucket: bucket,
          continuation_token: continuation_token,
          max_keys: 1000
        )

        response.contents&.each do |obj|
          size = obj.size || 0
          total_bytes += size
          total_objects += 1

          prefix = obj.key.to_s.split("/").first
          by_prefix[prefix][:count] += 1
          by_prefix[prefix][:bytes] += size
        end

        break unless response.is_truncated
        continuation_token = response.next_continuation_token
        sampled = true if total_objects >= 100_000
        break if total_objects >= 100_000
      end

      # Convert prefix stats to GB for readability
      prefix_stats = by_prefix.sort_by { |_, v| -v[:bytes] }.map do |name, data|
        {
          name: name,
          count: data[:count],
          sizeGB: (data[:bytes] / (1024.0**3)).round(2)
        }
      end

      {
        total_bytes: total_bytes,
        total_objects: total_objects,
        sampled: sampled,
        by_prefix: prefix_stats
      }
    end
  end
end
