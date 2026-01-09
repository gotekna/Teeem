# frozen_string_literal: true

module Api
  module V1
    # Gold Standard Search Infrastructure - Search Controller
    #
    # Unified search endpoint for all TEEEM data.
    # Uses PostgreSQL full-text search with GIN indexes.
    #
    # Endpoints:
    #   GET /api/v1/search?q=query&types=emails,documents&limit=20
    #
    class SearchController < ApplicationController
      # GET /api/v1/search
      # Global search across all types
      #
      # Params:
      #   q: Search query (required)
      #   types: Comma-separated list of types to search (optional)
      #          Valid types: emails, documents, jobs, contacts, tasks, purchase_orders
      #   limit: Max results per type (default: 20, max: 100)
      #
      def index
        query = params[:q] || params[:query] || params[:search]

        if query.blank?
          return render json: {
            success: false,
            error: "Query parameter 'q' is required"
          }, status: :bad_request
        end

        service = GlobalSearchService.new(user: current_user)
        results = service.search(
          query,
          types: params[:types],
          limit: params[:limit] || 20
        )

        render json: results
      end

      # GET /api/v1/search/:type
      # Search a single type with pagination
      #
      # Params:
      #   q: Search query (required)
      #   limit: Max results (default: 20, max: 100)
      #   offset: Pagination offset (default: 0)
      #
      def show
        query = params[:q] || params[:query] || params[:search]
        type = params[:id]

        unless GlobalSearchService::SEARCHABLE_TYPES.key?(type)
          return render json: {
            success: false,
            error: "Invalid type: #{type}",
            valid_types: GlobalSearchService.available_types
          }, status: :bad_request
        end

        if query.blank?
          return render json: {
            success: false,
            error: "Query parameter 'q' is required"
          }, status: :bad_request
        end

        service = GlobalSearchService.new(user: current_user)
        results = service.search_single(
          type,
          query,
          limit: params[:limit] || 20,
          offset: params[:offset] || 0
        )

        render json: results
      end

      # GET /api/v1/search/types
      # List available search types and their status
      def types
        types_status = GlobalSearchService.available_types.map do |type|
          {
            type: type,
            configured: GlobalSearchService.configured?(type),
            model: GlobalSearchService::SEARCHABLE_TYPES[type].name
          }
        end

        render json: {
          success: true,
          types: types_status
        }
      end
    end
  end
end
