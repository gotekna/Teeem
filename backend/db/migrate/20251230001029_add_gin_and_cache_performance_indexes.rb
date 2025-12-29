class AddGinAndCachePerformanceIndexes < ActiveRecord::Migration[8.0]
  # Performance optimization indexes identified from Performance Observatory
  # See: /system-health?tab=performance
  #
  # Issues addressed:
  # 1. sm_schedule_masters JSONB queries doing full table scans (predecessor_ids, sm_template_ids)
  # 2. solid_cache_entries cleanup queries lacking created_at index

  def change
    # GIN indexes for JSONB columns used in SmScheduleMaster validation queries
    # These enable fast containment (@>) queries on predecessor_ids and sm_template_ids
    add_index :sm_schedule_master, :predecessor_ids, using: :gin,
      name: "index_sm_schedule_master_on_predecessor_ids_gin",
      if_not_exists: true

    add_index :sm_schedule_master, :sm_template_ids, using: :gin,
      name: "index_sm_schedule_master_on_sm_template_ids_gin",
      if_not_exists: true

    # Index for SolidCache cleanup operations
    # Allows efficient querying of oldest entries for cache eviction
    add_index :solid_cache_entries, :created_at,
      name: "index_solid_cache_entries_on_created_at",
      if_not_exists: true
  end
end
