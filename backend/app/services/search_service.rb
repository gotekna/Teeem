# frozen_string_literal: true

# SSoT: SearchService - THE single source of truth for all search operations
#
# Supports 5 search modes:
# - contains (default): Substring match using ILIKE %term%
# - exact: Case-insensitive exact match
# - starts_with: Prefix match using ILIKE term%
# - fuzzy: Trigram similarity search for typo tolerance (requires pg_trgm)
# - regex: PostgreSQL regex search (~* for case-insensitive)
#
# Usage:
#   SearchService.apply(query, search_term, columns: ['name', 'email'], mode: 'starts_with')
#   SearchService.apply(query, search_term, model: User, mode: 'fuzzy')
#
class SearchService
  VALID_MODES = %w[contains exact starts_with fuzzy regex].freeze
  DEFAULT_MODE = 'contains'

  class << self
    # Apply search filter to an ActiveRecord query
    #
    # @param query [ActiveRecord::Relation] The base query to filter
    # @param search_term [String] The search term
    # @param options [Hash] Search options
    # @option options [Array<String>] :columns Columns to search (required if no model)
    # @option options [Class] :model ActiveRecord model class (for auto-detecting text columns)
    # @option options [String] :mode Search mode (contains, exact, starts_with, fuzzy, regex)
    # @option options [Boolean] :search_all Search all text columns (default: false)
    # @option options [Integer] :fuzzy_limit Max columns for fuzzy search (default: 5)
    # @return [ActiveRecord::Relation] Filtered query
    #
    def apply(query, search_term, options = {})
      return query if search_term.blank?

      mode = (options[:mode] || DEFAULT_MODE).to_s
      mode = DEFAULT_MODE unless VALID_MODES.include?(mode)

      columns = determine_searchable_columns(query, options)
      return query if columns.empty?

      conn = ActiveRecord::Base.connection
      model = options[:model] || query.model

      # Get column type information for proper casting
      column_types = model.columns.each_with_object({}) { |c, h| h[c.name] = c }

      case mode
      when 'exact'
        apply_exact_search(query, search_term, columns, column_types, conn)
      when 'starts_with'
        apply_starts_with_search(query, search_term, columns, column_types, conn)
      when 'fuzzy'
        apply_fuzzy_search(query, search_term, columns, column_types, conn, options[:fuzzy_limit] || 5)
      when 'regex'
        apply_regex_search(query, search_term, columns, column_types, conn)
      else # 'contains'
        apply_contains_search(query, search_term, columns, column_types, conn)
      end
    end

    private

    # Determine which columns to search
    def determine_searchable_columns(query, options)
      if options[:columns].present?
        Array(options[:columns])
      elsif options[:model].present?
        auto_detect_text_columns(options[:model], options[:search_all])
      else
        auto_detect_text_columns(query.model, options[:search_all])
      end
    end

    # Auto-detect text columns from model
    def auto_detect_text_columns(model, search_all = false)
      text_types = [:string, :text]
      columns = model.columns.select do |c|
        text_types.include?(c.type) && !c.array
      end.map(&:name)

      # If not searching all, limit to first 5 columns for performance
      search_all ? columns : columns.first(5)
    end

    # Get SQL-safe column reference with TEXT casting for non-text types
    def column_sql(column_name, column_types, conn)
      col_info = column_types[column_name]
      needs_cast = col_info && [:integer, :bigint, :decimal, :float, :boolean, :date, :datetime].include?(col_info.type)

      if needs_cast
        "CAST(#{conn.quote_column_name(column_name)} AS TEXT)"
      else
        conn.quote_column_name(column_name)
      end
    end

    # Contains search: ILIKE %term%
    def apply_contains_search(query, search_term, columns, column_types, conn)
      conditions = columns.map do |col|
        "#{column_sql(col, column_types, conn)} ILIKE :search"
      end.join(' OR ')

      query.where(conditions, search: "%#{search_term}%")
    end

    # Exact search: case-insensitive exact match
    def apply_exact_search(query, search_term, columns, column_types, conn)
      conditions = columns.map do |col|
        "LOWER(#{column_sql(col, column_types, conn)}) = LOWER(:search)"
      end.join(' OR ')

      query.where(conditions, search: search_term)
    end

    # Starts with search: ILIKE term%
    def apply_starts_with_search(query, search_term, columns, column_types, conn)
      conditions = columns.map do |col|
        "#{column_sql(col, column_types, conn)} ILIKE :search"
      end.join(' OR ')

      query.where(conditions, search: "#{search_term}%")
    end

    # Fuzzy search: Trigram similarity for typo tolerance
    def apply_fuzzy_search(query, search_term, columns, column_types, conn, limit)
      fuzzy_columns = columns.first(limit)
      sanitized_search = conn.quote(search_term)

      # Trigram similarity conditions
      fuzzy_conditions = fuzzy_columns.map do |col|
        "word_similarity(#{sanitized_search}, COALESCE(#{column_sql(col, column_types, conn)}, '')) > 0.3"
      end.join(' OR ')

      # Also include ILIKE as fallback (trigrams work better with 3+ chars)
      ilike_conditions = columns.map do |col|
        "#{column_sql(col, column_types, conn)} ILIKE :search"
      end.join(' OR ')

      combined = "(#{ilike_conditions}) OR (#{fuzzy_conditions})"
      result = query.where(combined, search: "%#{search_term}%")

      # Order by similarity (best matches first)
      if fuzzy_columns.any?
        primary_col = column_sql(fuzzy_columns.first, column_types, conn)
        result = result.order(Arel.sql("word_similarity(#{sanitized_search}, COALESCE(#{primary_col}, '')) DESC"))
      end

      result
    end

    # Regex search: PostgreSQL ~* operator
    def apply_regex_search(query, search_term, columns, column_types, conn)
      # Validate regex is valid
      begin
        Regexp.new(search_term)
      rescue RegexpError => e
        Rails.logger.warn "[SearchService] Invalid regex: #{search_term} - #{e.message}, falling back to contains"
        return apply_contains_search(query, search_term, columns, column_types, conn)
      end

      conditions = columns.map do |col|
        "#{column_sql(col, column_types, conn)} ~* :search"
      end.join(' OR ')

      query.where(conditions, search: search_term)
    end
  end
end
