# frozen_string_literal: true

# WarehouseFolderCount - Cached document counts per folder path prefix
#
# Stores materialized counts for each folder path prefix + depth combination.
# This allows the tree API to return accurate counts without scanning all documents.
#
# Staleness:
#   - stale_at is set when documents in that path prefix are created/updated/deleted
#   - Stale counts are refreshed on next query or by a background job
#   - null stale_at = count is fresh
#
# Usage:
#   WarehouseFolderCount.count_for(tenant_id, "Job/In Progress", 2)
#   # => 1234 (returns cached count, refreshes if stale)
#
#   WarehouseFolderCount.invalidate_path(tenant_id, "Job/In Progress/J-001/Photo")
#   # => Marks all parent prefixes as stale
#
class WarehouseFolderCount < ApplicationRecord
  belongs_to :tenant

  validates :folder_path_prefix, presence: true
  validates :depth, presence: true, numericality: { greater_than_or_equal_to: 0 }

  scope :for_tenant, ->(tid) { where(tenant_id: tid) }
  scope :stale, -> { where.not(stale_at: nil) }
  scope :fresh, -> { where(stale_at: nil) }
  scope :at_depth, ->(d) { where(depth: d) }

  # Get document count for a path prefix at a given depth
  # Returns cached count if fresh, recomputes if stale or missing
  #
  # @param tenant_id [Integer]
  # @param prefix [String] e.g., "Job/In Progress"
  # @param depth [Integer] e.g., 2
  # @return [Integer] document count
  def self.count_for(tenant_id, prefix, depth)
    record = find_or_initialize_by(
      tenant_id: tenant_id,
      folder_path_prefix: prefix,
      depth: depth
    )

    if record.new_record? || record.stale_at.present?
      count = recompute_count(tenant_id, prefix)
      record.update!(document_count: count, stale_at: nil)
    end

    record.document_count
  end

  # Get counts for all children of a path prefix at the next depth level
  #
  # @param tenant_id [Integer]
  # @param prefix [String] e.g., "Job" (top level) or "Job/In Progress"
  # @param target_depth [Integer] The depth of children to count
  # @return [Hash] { "In Progress" => 500, "Completed" => 300, ... }
  def self.children_counts(tenant_id, prefix, target_depth)
    # Use materialized counts if available and fresh
    cached = for_tenant(tenant_id)
      .at_depth(target_depth)
      .where("folder_path_prefix LIKE ?", "#{sanitize_sql_like(prefix)}/%")
      .fresh

    if cached.exists?
      return cached.each_with_object({}) do |record, hash|
        # Extract the child segment from the prefix
        child_segment = record.folder_path_prefix.sub("#{prefix}/", "").split("/").first
        hash[child_segment] = (hash[child_segment] || 0) + record.document_count
      end
    end

    # Fall back to live query and cache results
    recompute_children_counts(tenant_id, prefix, target_depth)
  end

  # Mark all parent prefixes of a path as stale
  #
  # @param tenant_id [Integer]
  # @param full_path [String] e.g., "Job/In Progress/J-001/Photo"
  def self.invalidate_path(tenant_id, full_path)
    return if full_path.blank?

    # Build all parent prefixes: "Job", "Job/In Progress", "Job/In Progress/J-001", etc.
    segments = full_path.split("/")
    prefixes = (1..segments.length).map { |i| segments[0...i].join("/") }

    where(tenant_id: tenant_id, folder_path_prefix: prefixes)
      .update_all(stale_at: Time.current)
  end

  # Recompute and cache count for a specific prefix
  def self.recompute_count(tenant_id, prefix)
    WarehouseDocument
      .where(tenant_id: tenant_id)
      .where("folder_path LIKE ?", "#{sanitize_sql_like(prefix)}%")
      .count
  end

  # Recompute children counts from live data
  def self.recompute_children_counts(tenant_id, prefix, target_depth)
    # Count documents grouped by the segment at target_depth
    result = WarehouseDocument
      .where(tenant_id: tenant_id)
      .where("folder_path LIKE ?", "#{sanitize_sql_like(prefix)}/%")
      .group(Arel.sql("split_part(folder_path, '/', #{target_depth})"))
      .count

    # Cache the results
    result.each do |segment, count|
      next if segment.blank?

      child_prefix = "#{prefix}/#{segment}"
      upsert(
        {
          tenant_id: tenant_id,
          folder_path_prefix: child_prefix,
          depth: target_depth,
          document_count: count,
          stale_at: nil,
          created_at: Time.current,
          updated_at: Time.current
        },
        unique_by: [:tenant_id, :depth, :folder_path_prefix]
      )
    end

    result
  end
end
