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
    class DocumentInboxesController < ApplicationController
      before_action :set_item, only: [:show, :destroy, :classify, :route, :override, :download, :classification]

      # GET /api/v1/docsort
      def index
        items = DocumentInbox.includes(:storage_blob, :uploaded_by, :synced_email)

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
            item = DocumentInbox.create_from_upload!(
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
      # Params:
      #   hard: true - permanently delete (default for docsort items)
      def destroy
        # Hard delete - permanently remove from docsort
        if params[:hard] == 'true' || params[:hard] == true
          @item.destroy!
          render json: { success: true, message: 'Item permanently deleted' }
        elsif @item.status.in?(%w[pending classified error])
          @item.archive!
          render json: { success: true, message: 'Item archived' }
        elsif @item.status == 'archived'
          @item.destroy!
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

        # Optional: allow specifying job_id or corporate_id for routing
        if params[:job_id].present?
          @item.metadata['job_id'] = params[:job_id]
          @item.save!
        end
        if params[:corporate_id].present?
          @item.metadata['corporate_id'] = params[:corporate_id]
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
          url = @item.download_url(expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT)
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
        items = DocumentInbox.all

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

      # GET /api/v1/document_inboxes/:id/classification
      # Returns the same ClassificationData shape as company_documents/:id/classification
      # so ClassificationPanel can consume it uniformly.
      def classification
        classification = @item.classification_result || {}
        methods = classification.is_a?(Hash) ? (classification["methods"] || classification[:methods] || {}) : {}

        # Build OCR breakdown from content_match method
        content_match = methods["content_match"] || methods[:content_match] || {}
        ocr_doc_type = content_match["document_type"] || content_match[:document_type]
        ocr_resolved = resolve_inbox_doc_type_fields(ocr_doc_type)
        ocr_data = {
          document_type: ocr_doc_type,
          confidence: ((content_match["confidence"] || content_match[:confidence] || 0).to_f * 100).round,
          signals: content_match["signals"] || content_match[:signals] || content_match["matched_terms"] || content_match[:matched_terms] || [],
          text_preview: content_match["text_preview"] || content_match[:text_preview],
          status: content_match["status"] || content_match[:status] || "not_available",
          duration_ms: content_match["duration_ms"] || content_match[:duration_ms],
          resolved_folder: ocr_resolved[:folder],
          resolved_ui_name: ocr_resolved[:ui_name],
          resolved_dl_name: ocr_resolved[:dl_name]
        }

        # Build AI breakdown from ai_match method
        ai_match = methods["ai_match"] || methods[:ai_match] || {}
        ai_doc_type = ai_match["document_type"] || ai_match[:document_type]
        ai_resolved = resolve_inbox_doc_type_fields(ai_doc_type)
        ai_data = {
          document_type: ai_doc_type,
          confidence: ((ai_match["confidence"] || ai_match[:confidence] || 0).to_f * 100).round,
          signals: ai_match["signals"] || ai_match[:signals] || [],
          status: ai_match["status"] || ai_match[:status] || "not_available",
          duration_ms: ai_match["duration_ms"] || ai_match[:duration_ms],
          resolved_folder: ai_resolved[:folder],
          resolved_ui_name: ai_resolved[:ui_name],
          resolved_dl_name: ai_resolved[:dl_name]
        }

        # Name match data
        name_match = methods["name_match"] || methods[:name_match] || {}
        nm_doc_type = name_match["document_type"] || name_match[:document_type]
        nm_resolved = resolve_inbox_doc_type_fields(nm_doc_type)
        name_data = {
          document_type: nm_doc_type,
          confidence: ((name_match["confidence"] || name_match[:confidence] || 0).to_f * 100).round,
          signals: name_match["signals"] || name_match[:signals] || [],
          status: name_match["status"] || name_match[:status] || "not_available",
          resolved_folder: nm_resolved[:folder],
          resolved_ui_name: nm_resolved[:ui_name],
          resolved_dl_name: nm_resolved[:dl_name]
        }

        # Resolve fields for the item's current doc type
        current_doc_type = @item.document_type
        current_resolved = resolve_inbox_doc_type_fields(current_doc_type)

        render json: {
          success: true,
          has_classification: classification.present?,
          winner: classification["winner"] || classification[:winner],
          current: {
            resolved_folder: current_resolved[:folder],
            resolved_ui_name: current_resolved[:ui_name],
            resolved_dl_name: current_resolved[:dl_name]
          },
          ocr: ocr_data,
          ai: ai_data,
          name_match: name_data,
          classified_at: classification["classified_at"] || classification[:classified_at]
        }
      end

      private

      def set_item
        @item = DocumentInbox.find(params[:id])
      end

      def resolve_inbox_doc_type_fields(doc_type_slug)
        return { folder: nil, ui_name: nil, dl_name: nil } if doc_type_slug.blank?

        dt = DocumentType.find_by_name_or_alias(doc_type_slug) ||
          DocumentType.find_by("lower(name) = ? OR lower(replace(name, ' ', '_')) = ?",
            doc_type_slug.tr('_', ' ').downcase,
            doc_type_slug.downcase
          )
        return { folder: nil, ui_name: nil, dl_name: nil } unless dt

        folder = dt.folder

        # SSoT: Use WFDT effective template chain (WFDT → DocumentType → WarehouseFolder)
        primary_wfdt = dt.warehouse_folder_document_types.find_by(is_primary: true) ||
                       dt.warehouse_folder_document_types.first

        ui_template = primary_wfdt&.effective_ui_name_template || dt.ui_name
        dl_template = primary_wfdt&.effective_download_name_template || dt.download_name

        # Build minimal context for template expansion (no warehouse doc for inbox items)
        context = {
          doc_type_name: dt.name,
          doc_type_code: dt.abbreviation || dt&.code,
          document_date: @item&.created_at || Time.current,
          original_filename: @item&.original_filename,
          folder: folder
        }

        # Add company context from metadata if available
        if @item&.metadata.is_a?(Hash)
          if @item.metadata["company_id"].present?
            company = Corporate.find_by(id: @item.metadata["company_id"])
            if company
              context[:company_code] = company.company_code || company&.code
              context[:company_name] = company.name
              context[:company_group] = company.company_group&.name
            end
          end
        end

        resolver = SendNameResolver.new
        resolved_ui = ui_template.present? ? resolver.send(:expand_template, ui_template, context) : nil
        resolved_dl = if dl_template.present?
          expanded = resolver.send(:expand_template, dl_template, context)
          expanded.present? ? resolver.send(:sanitize_and_ensure_extension, expanded, @item) : nil
        end

        { folder: folder, ui_name: resolved_ui, dl_name: resolved_dl }
      rescue StandardError => e
        Rails.logger.debug "[DocumentInboxes] resolve_inbox_doc_type_fields failed for '#{doc_type_slug}': #{e.message}"
        { folder: nil, ui_name: nil, dl_name: nil }
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
          classification_result: item.classification_result,
          created_at: item.created_at,
          updated_at: item.updated_at
        }

        if detailed
          base.merge!(
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
