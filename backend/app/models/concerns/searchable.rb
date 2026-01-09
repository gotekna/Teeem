# frozen_string_literal: true

# Gold Standard Search Infrastructure (SSoT)
#
# Include this concern in models that need PostgreSQL full-text search.
# The tsvector column and GIN index are created via migrations.
# Triggers auto-update the searchable column on insert/update.
#
# Usage:
#   class Job < ApplicationRecord
#     include Searchable
#     searchable_columns :name, :address, :client_name, :description
#   end
#
#   Job.search_text("invoice")
#   Job.search_text("concrete slab")
#
module Searchable
  extend ActiveSupport::Concern

  TSVECTOR_COLUMN = :searchable

  included do
    # Full-text search scope using PostgreSQL tsvector
    # Returns records matching the query with English stemming
    # e.g., "running" matches "run", "runs", "running"
    scope :search_text, ->(query) {
      return all if query.blank?

      where("#{TSVECTOR_COLUMN} @@ plainto_tsquery('english', ?)", query.to_s.strip)
    }

    # Ranked search with relevance ordering
    # Uses ts_rank to order by match quality
    scope :search_ranked, ->(query) {
      return all if query.blank?

      query = query.to_s.strip
      select("#{table_name}.*, ts_rank(#{TSVECTOR_COLUMN}, plainto_tsquery('english', #{connection.quote(query)})) AS search_rank")
        .where("#{TSVECTOR_COLUMN} @@ plainto_tsquery('english', ?)", query)
        .order("search_rank DESC")
    }

    # Combined search: tsvector for whole words + ILIKE for partial matches
    # Use this when users expect "inv" to match "invoice"
    scope :search_flexible, ->(query) {
      return all if query.blank?

      query = query.to_s.strip
      like_columns = respond_to?(:get_searchable_columns) ? get_searchable_columns : [:name]
      like_clauses = like_columns.map { |col| "#{table_name}.#{col} ILIKE :pattern" }.join(" OR ")

      where(
        "(#{TSVECTOR_COLUMN} @@ plainto_tsquery('english', :query)) OR (#{like_clauses})",
        query: query,
        pattern: "%#{sanitize_sql_like(query)}%"
      )
    }
  end

  class_methods do
    # Define which columns to include in the searchable tsvector
    # These are used by database triggers to build the tsvector
    def searchable_columns(*columns)
      @searchable_columns = columns.map(&:to_sym)
    end

    def get_searchable_columns
      @searchable_columns || [:name]
    end

    # Check if the searchable column and index exist
    def searchable_configured?
      column_names.include?(TSVECTOR_COLUMN.to_s) &&
        connection.indexes(table_name).any? { |idx| idx.columns.include?(TSVECTOR_COLUMN.to_s) }
    end

    # Manual backfill: Update all records to regenerate searchable vector
    # This fires the trigger for each row
    # Use with caution on large tables - consider batching
    def backfill_searchable!(batch_size: 1000)
      unless searchable_configured?
        raise "Searchable not configured for #{name}. Run migrations first."
      end

      find_in_batches(batch_size: batch_size) do |batch|
        # Touch each record to fire the trigger
        where(id: batch.map(&:id)).update_all(updated_at: Time.current)
      end
    end
  end
end
