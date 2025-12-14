# Service to keep FoundationViews in sync with their Foundation's columns
# Automatically adds missing columns and removes obsolete ones from view configurations
class FoundationViewSyncService
  class << self
    # Sync all views for a specific foundation
    # @param foundation [Foundation] The foundation whose views need syncing
    # @param column_name [String, nil] Optional specific column to add/remove
    # @return [Hash] Summary of changes made
    def sync_foundation_views(foundation, column_name: nil)
      all_columns = foundation.columns.pluck(:column_name)
      views = FoundationView.where(foundation_id: foundation.id)

      return { synced: 0, added: 0, removed: 0 } if views.empty?

      synced_count = 0
      total_added = 0
      total_removed = 0

      views.each do |view|
        result = sync_view(view, all_columns, column_name: column_name)
        if result[:changed]
          synced_count += 1
          total_added += result[:added]
          total_removed += result[:removed]
        end
      end

      {
        synced: synced_count,
        added: total_added,
        removed: total_removed
      }
    end

    # Sync a single view with the foundation's columns
    # @param view [FoundationView] The view to sync
    # @param all_columns [Array<String>] All column names from the foundation
    # @param column_name [String, nil] Optional specific column to add/remove
    # @return [Hash] Summary of changes
    def sync_view(view, all_columns, column_name: nil)
      view_columns = view.columns["visible"]&.keys || []

      # If a specific column is provided, only add/remove that one
      if column_name.present?
        if all_columns.include?(column_name) && !view_columns.include?(column_name)
          # Add the new column
          add_column_to_view(view, column_name)
          return { changed: true, added: 1, removed: 0 }
        elsif !all_columns.include?(column_name) && view_columns.include?(column_name)
          # Remove the obsolete column
          remove_column_from_view(view, column_name)
          return { changed: true, added: 0, removed: 1 }
        end
        return { changed: false, added: 0, removed: 0 }
      end

      # Full sync: check for all missing and extra columns
      missing = all_columns - view_columns
      extra = view_columns - all_columns

      return { changed: false, added: 0, removed: 0 } if missing.empty? && extra.empty?

      # Add missing columns (default to hidden)
      missing.each { |col| add_column_to_view(view, col) }

      # Remove extra columns
      extra.each { |col| remove_column_from_view(view, col) }

      # Skip validation to avoid issues with orphaned personal views
      view.save!(validate: false)

      {
        changed: true,
        added: missing.count,
        removed: extra.count
      }
    end

    private

    # Add a column to a view's configuration (defaults to hidden)
    def add_column_to_view(view, column_name)
      view.columns["visible"] ||= {}
      view.columns["visible"][column_name] = false

      # Add to end of order array if not present
      view.columns["order"] ||= []
      view.columns["order"] << column_name unless view.columns["order"].include?(column_name)

      # Save immediately if this is a single-column operation
      view.save!(validate: false) if view.changed?
    end

    # Remove a column from a view's configuration
    def remove_column_from_view(view, column_name)
      view.columns["visible"]&.delete(column_name)
      view.columns["order"]&.delete(column_name)
      view.columns["widths"]&.delete(column_name)

      # Save immediately if this is a single-column operation
      view.save!(validate: false) if view.changed?
    end
  end
end
