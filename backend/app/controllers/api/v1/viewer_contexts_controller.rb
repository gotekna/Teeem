# frozen_string_literal: true

module Api
  module V1
    # ViewerContextsController - Stores document viewer context (Q&A, file lists)
    #
    # Problem: Enhanced document viewer URLs include all context (files, Q&A, presigned URLs)
    # encoded in the URL. With long presigned S3 URLs, this often exceeds browser URL limits.
    #
    # Solution: Store context server-side, return short ID. Viewer fetches context by ID.
    #
    # Endpoints:
    #   POST /api/v1/viewer_contexts - Store context, return ID
    #   GET /api/v1/viewer_contexts/:id - Get stored context
    #
    # Context stored in Rails.cache with 24-hour expiry (anonymous access, no auth needed)
    class ViewerContextsController < ApplicationController
      include CacheConstants

      # Public endpoint - viewer contexts are anonymous/ephemeral
      skip_before_action :authorize_request, only: [:show, :create]
      skip_before_action :set_tenant, only: [:show, :create]

      # POST /api/v1/viewer_contexts
      # Store viewer context and return a short ID
      # @param context [Hash] The viewer context (files, Q&A, etc.)
      # @return [Hash] { id: "abc123" }
      def create
        context = viewer_context_params

        # Generate short ID
        id = SecureRandom.urlsafe_base64(6) # 8 chars

        # FRC (Jan 2026): Use 7-day expiry to match typical presigned URL expiry
        # Note: Can't use WarehouseProvider.instance here - this is a public endpoint without tenant context
        # The viewer context just needs to outlive the presigned URLs it contains, which are typically 7 days
        Rails.cache.write("viewer_context:#{id}", context.to_json, expires_in: CACHE_TTL_WEEKLY)

        render json: { success: true, id: id }
      rescue => e
        Rails.logger.error "[ViewerContexts#create] Error: #{e.message}"
        render_error("Failed to store context", status: :internal_server_error)
      end

      # GET /api/v1/viewer_contexts/:id
      # Retrieve stored viewer context
      # @param id [String] The context ID
      # @return [Hash] The stored context
      def show
        cached = Rails.cache.read("viewer_context:#{params[:id]}")

        if cached
          render json: { success: true, context: JSON.parse(cached) }
        else
          render_error("Context not found or expired", status: :not_found)
        end
      rescue => e
        Rails.logger.error "[ViewerContexts#show] Error: #{e.message}"
        render_error("Failed to retrieve context", status: :internal_server_error)
      end

      private

      # Viewer context is ephemeral (cache-stored, 7-day expiry) and public.
      # We permit all keys within the context hash since it's just serialized
      # to cache - no database writes, no security implications.
      # Frontend sends: { files: [{ name, downloadUrl, openUrl }], allQA: [...], currentIndex: N }
      def viewer_context_params
        raw = params[:context].present? ? params[:context] : params
        raw.permit!.to_h
      end
    end
  end
end
