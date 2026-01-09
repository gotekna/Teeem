# Centralized service for resolving display values from any model
# This is the Single Source of Truth for "how to display a record"
#
# SSoT USAGE:
#   - Generic display: DisplayValueResolver.resolve(record)
#   - Lookup columns:  DisplayValueResolver.resolve_lookup(record, column)
#   - Batch lookup:    DisplayValueResolver.resolve_lookup_batch(records, column)
#
# DO NOT use column.lookup_display_column directly - always go through this service
class DisplayValueResolver
  class << self
    # Get the best display value for any ActiveRecord model
    # Order of preference: display_name > name > title > subject > ID fallback
    def resolve(record)
      return "Unknown" if record.nil?

      # Try display_name first (standard convention across app)
      return record.display_name if record.respond_to?(:display_name) && record.display_name.present?

      # Try name (most models)
      return record.name if record.respond_to?(:name) && record.name.present?

      # Try title (documents, items)
      return record.title if record.respond_to?(:title) && record.title.present?

      # Try subject (emails, messages)
      return record.subject if record.respond_to?(:subject) && record.subject.present?

      # Fallback to ID
      "#{record.class.name} ##{record.id}"
    end

    # Alias for convenience
    def call(record)
      resolve(record)
    end

    # Column-aware resolution for lookup columns
    # Respects the column's lookup_display_column configuration
    # Falls back to standard resolve() chain if display column isn't available
    #
    # @param record [ActiveRecord::Base] The lookup record to display
    # @param column [Column, nil] The Column definition with lookup_display_column
    # @return [String] The display value
    def resolve_lookup(record, column)
      return "Unknown" if record.nil?

      # If no column provided or not a lookup type, use standard resolution
      return resolve(record) unless column&.column_type&.in?(%w[lookup multiple_lookups])

      # Try the configured lookup_display_column first
      display_col = column.lookup_display_column
      if display_col.present? && record.respond_to?(display_col)
        value = record.send(display_col)
        return value.to_s if value.present?
      end

      # Fallback to standard resolution chain
      resolve(record)
    end

    # Batch resolution for performance (avoids N+1 queries)
    # Returns a hash of { id => display_value }
    #
    # @param records [Array<ActiveRecord::Base>, ActiveRecord::Relation] Records to resolve
    # @param column [Column] The Column definition with lookup_display_column
    # @return [Hash<Integer, String>] Map of record ID to display value
    def resolve_lookup_batch(records, column)
      return {} if records.blank?

      records.index_by(&:id).transform_values do |record|
        resolve_lookup(record, column)
      end
    end
  end
end
