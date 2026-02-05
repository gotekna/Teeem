# frozen_string_literal: true

module Api
  module V1
    # DocsortController - Universal document inbox API
    #
    # Endpoints:
    #   GET    /api/v1/docsort           - List items
    #   GET    /api/v1/docsort/:id       - Show item
    #   POST   /api/v1/docsort           - Upload file(s)
    #   DELETE /api/v1/docsort/:id       - Delete/archive item
    #   POST   /api/v1/docsort/:id/classify   - Re-classify item
    #   POST   /api/v1/docsort/:id/route      - Route item to handler
    #   PATCH  /api/v1/docsort/:id/override   - Manual classification override
    #   GET    /api/v1/docsort/:id/download   - Download file
    #   GET    /api/v1/docsort/stats          - Get statistics
    #
    class DocsortController < ApplicationController
      before_action :set_item, only: [:show, :destroy, :classify, :route, :override, :download]

      # GET /api/v1/docsort
      def index
        items = DocsortItem.includes(:storage_blob, :uploaded_by, :synced_email)

        # Filter by status
        items = items.where(status: params[:status]) if params[:status].present?

        # Filter by document type
        items = items.where(document_type: params[:document_type]) if params[:document_type].present?

        # Filter by source
        items = items.where(source: params[:source]) if params[:source].present?

        # Filter by needs review
        items = items.needs_review if params[:needs_review] == 'true'

        # Filter by active only (exclude completed/archived)
        items = items.active if params[:active] == 'true'

        # Search
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          items = items.where(
            'LOWER(original_filename) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(from_email) LIKE ?',
            search_term, search_term, search_term
          )
        end

        # Manual pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 25).to_i
        total_count = items.count
        total_pages = (total_count.to_f / per_page).ceil

        items = items.recent.limit(per_page).offset((page - 1) * per_page)

        render json: {
          items: items.map { |item| serialize_item(item) },
          meta: {
            total_count: total_count,
            total_pages: total_pages,
            current_page: page,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/docsort/:id
      def show
        render json: serialize_item(@item, detailed: true)
      end

      # POST /api/v1/docsort
      def create
        # Support single file or multiple files
        files = params[:files] || [params[:file]]
        files = files.compact

        if files.empty?
          return render json: { error: 'No files provided' }, status: :unprocessable_entity
        end

        created_items = []
        errors = []

        files.each do |file|
          begin
            item = DocsortItem.create_from_upload!(
              file: file,
              user: current_user,
              metadata: {
                uploaded_at: Time.current,
                user_agent: request.user_agent
              }
            )
            created_items << item
          rescue StandardError => e
            errors << { filename: file.original_filename, error: e.message }
          end
        end

        if created_items.any?
          render json: {
            items: created_items.map { |item| serialize_item(item) },
            errors: errors.presence,
            message: "#{created_items.length} file(s) uploaded successfully"
          }, status: :created
        else
          render json: {
            error: 'Failed to upload files',
            errors: errors
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/docsort/:id
      def destroy
        if @item.status.in?(%w[pending classified error])
          @item.archive!
          render json: { success: true, message: 'Item archived' }
        elsif @item.status == 'archived'
          @item.destroy
          render json: { success: true, message: 'Item deleted' }
        else
          render json: {
            error: "Cannot delete item in #{@item.status} status"
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/docsort/:id/classify
      def classify
        if @item.status == 'completed'
          return render json: { error: 'Item already processed' }, status: :unprocessable_entity
        end

        # Re-classify (even if already classified)
        result = @item.classify!

        render json: {
          success: true,
          item: serialize_item(@item.reload),
          classification: result
        }
      end

      # POST /api/v1/docsort/:id/route
      def route
        unless @item.status.in?(%w[classified error])
          return render json: {
            error: 'Item must be classified before routing'
          }, status: :unprocessable_entity
        end

        # Optional: allow specifying job_id for routing
        if params[:job_id].present?
          @item.metadata['job_id'] = params[:job_id]
          @item.save!
        end

        result = @item.route!

        render json: {
          success: result[:success],
          item: serialize_item(@item.reload),
          routing: result
        }
      end

      # PATCH /api/v1/docsort/:id/override
      def override
        unless params[:document_type].present?
          return render json: { error: 'document_type required' }, status: :unprocessable_entity
        end

        unless DocsortItem::DOCUMENT_TYPES.include?(params[:document_type])
          return render json: {
            error: 'Invalid document_type',
            valid_types: DocsortItem::DOCUMENT_TYPES
          }, status: :unprocessable_entity
        end

        @item.override_classification!(
          user: current_user,
          document_type: params[:document_type]
        )

        # Optionally auto-route after override
        if params[:auto_route] == 'true' || params[:auto_route] == true
          @item.route!
        end

        render json: {
          success: true,
          item: serialize_item(@item.reload)
        }
      end

      # GET /api/v1/docsort/:id/download
      def download
        unless @item.storage_blob.present?
          return render json: { error: 'No file attached' }, status: :not_found
        end

        # Return presigned URL for client-side download
        if params[:url_only] == 'true'
          url = @item.download_url(expires_in: 3600)
          render json: { url: url }
        else
          # Stream file content
          content = @item.download_content
          unless content
            return render json: { error: 'Failed to download file' }, status: :service_unavailable
          end

          disposition = params[:disposition] == 'attachment' ? 'attachment' : 'inline'
          send_data content,
                    filename: @item.original_filename || 'document',
                    type: @item.content_type || 'application/octet-stream',
                    disposition: disposition
        end
      end

      # GET /api/v1/docsort/stats
      def stats
        items = DocsortItem.all

        # Group by status
        status_counts = items.group(:status).count

        # Group by document type
        type_counts = items.where.not(document_type: nil).group(:document_type).count

        # Group by source
        source_counts = items.group(:source).count

        # Confidence distribution
        confidence_ranges = {
          high: items.high_confidence.count,
          medium: items.where('classification_confidence >= ? AND classification_confidence < ?', 0.6, 0.8).count,
          low: items.low_confidence.count,
          unclassified: items.where(classification_confidence: nil).count
        }

        render json: {
          total: items.count,
          active: items.active.count,
          by_status: status_counts,
          by_document_type: type_counts,
          by_source: source_counts,
          by_confidence: confidence_ranges,
          needs_review: items.needs_review.count,
          today_count: items.where('created_at >= ?', Time.current.beginning_of_day).count
        }
      end

      private

      def set_item
        @item = DocsortItem.find(params[:id])
      end

      def serialize_item(item, detailed: false)
        base = {
          id: item.id,
          source: item.source,
          status: item.status,
          document_type: item.document_type,
          document_type_label: item.document_type_label,
          classification_confidence: item.classification_confidence,
          confidence_percent: item.confidence_percent,
          confidence_color: item.confidence_color,
          original_filename: item.original_filename,
          content_type: item.content_type,
          file_size: item.file_size,
          from_email: item.from_email,
          subject: item.subject,
          user_override: item.user_override,
          routed_to_type: item.routed_to_type,
          routed_to_id: item.routed_to_id,
          routed_at: item.routed_at,
          error_message: item.error_message,
          status_color: item.status_color,
          source_icon: item.source_icon,
          display_name: item.display_name,
          can_auto_route: item.can_auto_route?,
          created_at: item.created_at,
          updated_at: item.updated_at
        }

        if detailed
          base.merge!(
            classification_result: item.classification_result,
            metadata: item.metadata,
            uploaded_by: item.uploaded_by&.slice(:id, :name, :email),
            overridden_by: item.overridden_by&.slice(:id, :name, :email),
            overridden_at: item.overridden_at,
            processed_at: item.processed_at,
            storage_blob: item.storage_blob&.slice(:id, :content_hash, :file_size, :content_type),
            synced_email: item.synced_email&.slice(:id, :subject, :from_email, :received_at)
          )
        end

        base
      end
    end
  end
end
