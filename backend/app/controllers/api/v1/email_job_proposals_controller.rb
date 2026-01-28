module Api
  module V1
    class EmailJobProposalsController < ApplicationController
      before_action :set_proposal, only: [ :show, :approve, :reject, :re_extract ]

      # GET /api/v1/email_job_proposals
      # List proposals with filtering
      def index
        proposals = EmailJobProposal
          .includes(:synced_email, :created_by_user, :approved_by_user, :job)

        # Filter by status (default: pending)
        status = params[:status] || "pending"
        proposals = proposals.where(status: status) if status.present?

        # Filter by current user's proposals
        if params[:my_proposals] == "true"
          proposals = proposals.for_user(current_user)
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = [ (params[:per_page] || 20).to_i, 100 ].min
        total = proposals.count

        proposals = proposals.recent.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          proposals: proposals.map { |p| serialize_proposal(p) },
          pagination: {
            page: page,
            per_page: per_page,
            total: total,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/email_job_proposals/:id
      # Get single proposal with full details
      def show
        render json: {
          success: true,
          proposal: serialize_proposal(@proposal, include_full_email: true)
        }
      end

      # POST /api/v1/email_job_proposals
      # Create new proposal from email
      def create
        email = SyncedEmail.find(params[:synced_email_id])

        # Check if email has already been actioned (rejected or assigned to job)
        if email.match_type == "rejected"
          return render json: {
            success: false,
            error: "This email was previously rejected and cannot create a new proposal"
          }, status: :unprocessable_entity
        end

        if email.job_id.present?
          return render json: {
            success: false,
            error: "This email is already assigned to a job"
          }, status: :unprocessable_entity
        end

        # Check if proposal already exists for this email
        existing_proposal = EmailJobProposal.find_by(
          synced_email: email,
          status: [ "pending", "approved" ]
        )

        if existing_proposal
          return render json: {
            success: false,
            error: "Proposal already exists for this email",
            proposal: serialize_proposal(existing_proposal)
          }, status: :unprocessable_entity
        end

        # Sync PDF attachments if not already synced
        # SSoT: Per-user Outlook credentials removed - uses org credentials
        # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents (WarehouseDocument)
        if email.has_attachments && email.attachment_documents.empty?
          begin
            email.sync_attachments!
          rescue StandardError => e
            Rails.logger.error "Failed to sync attachments: #{e.message}"
            # Continue with proposal creation even if attachment sync fails
          end
        end

        # Create proposal using service
        service = EmailToJobService.new(email, user: current_user)
        proposal = service.create_job_proposal

        render json: {
          success: true,
          proposal: serialize_proposal(proposal),
          message: "Job proposal created. Confidence: #{(proposal.confidence_score * 100).round}%"
        }, status: :created

      rescue EmailToJobService::RateLimitError => e
        render json: {
          success: false,
          error: e.message
        }, status: :too_many_requests

      rescue StandardError => e
        Rails.logger.error "Proposal creation error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to create proposal: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/email_job_proposals/:id/approve
      # Approve proposal and create job
      def approve
        unless @proposal.pending?
          return render json: {
            success: false,
            error: "Proposal is not pending (status: #{@proposal.status})"
          }, status: :unprocessable_entity
        end

        # Get user edits from params (optional)
        raw_edits = params[:user_edits] || params[:edits] || {}
        user_edits = raw_edits.respond_to?(:to_unsafe_h) ? raw_edits.to_unsafe_h : raw_edits

        # Create job using service
        service = EmailToJobService.new(@proposal.synced_email, user: current_user)
        job = service.approve_proposal(@proposal, user_edits: user_edits)

        render json: {
          success: true,
          job: job.as_json,
          proposal: serialize_proposal(@proposal.reload),
          message: "Job '#{job.title}' created successfully"
        }

      rescue EmailToJobService::JobCreationError => e
        render json: {
          success: false,
          error: e.message,
          proposal: serialize_proposal(@proposal.reload)
        }, status: :unprocessable_entity

      rescue StandardError => e
        Rails.logger.error "Job approval error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to create job: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/email_job_proposals/:id/reject
      # Reject proposal
      def reject
        unless @proposal.pending? || @proposal.error?
          return render json: {
            success: false,
            error: "Proposal is not pending or error (status: #{@proposal.status})"
          }, status: :unprocessable_entity
        end

        reason = params[:reason] || "No reason provided"
        @proposal.mark_rejected!(reason: reason)

        render json: {
          success: true,
          proposal: serialize_proposal(@proposal),
          message: "Proposal rejected"
        }

      rescue StandardError => e
        Rails.logger.error "Proposal rejection error: #{e.message}"
        render json: {
          success: false,
          error: e.message
        }, status: :internal_server_error
      end

      # POST /api/v1/email_job_proposals/:id/re_extract
      # Re-extract data from email and PDFs with latest extraction logic
      def re_extract
        unless @proposal.pending? || @proposal.error?
          return render json: {
            success: false,
            error: "Can only re-extract pending or error proposals (current status: #{@proposal.status})"
          }, status: :unprocessable_entity
        end

        email = @proposal.email_warehouse

        # Sync PDF attachments if not already synced
        # SSoT: Per-user Outlook credentials removed - uses org credentials
        # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents (WarehouseDocument)
        if email.has_attachments && email.attachment_documents.empty?
          begin
            email.sync_attachments!
            Rails.logger.info "Synced attachments for email #{email.id} during re-extraction"
          rescue StandardError => e
            Rails.logger.error "Failed to sync attachments during re-extraction: #{e.message}"
            # Continue with re-extraction even if attachment sync fails
          end
        end

        # Re-extract data using EmailToJobService
        start_time = Time.current
        service = EmailToJobService.new(email, user: current_user)
        extracted_data = service.extract_job_data

        processing_time = ((Time.current - start_time) * 1000).round

        # Update proposal with new extracted data (reset to pending if was error)
        @proposal.update!(
          extracted_data: extracted_data,
          processing_time_ms: processing_time,
          status: "pending",
          error_message: nil
        )

        Rails.logger.info "Re-extracted proposal #{@proposal.id}: confidence=#{extracted_data['confidence_score']}"

        render json: {
          success: true,
          proposal: serialize_proposal(@proposal.reload),
          message: "Proposal re-extracted successfully. Confidence: #{(extracted_data['confidence_score'] * 100).round}%"
        }

      rescue EmailToJobService::RateLimitError => e
        render json: {
          success: false,
          error: e.message
        }, status: :too_many_requests

      rescue StandardError => e
        Rails.logger.error "Re-extraction error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to re-extract proposal: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def set_proposal
        @proposal = EmailJobProposal.find(params[:id])
      end

      def serialize_proposal(proposal, include_full_email: false)
        data = {
          id: proposal.id,
          status: proposal.status,
          created_at: proposal.created_at,
          approved_at: proposal.approved_at,
          extracted_data: proposal.extracted_data,
          confidence_score: proposal.confidence_score,
          high_confidence: proposal.high_confidence?,
          medium_confidence: proposal.medium_confidence?,
          low_confidence: proposal.low_confidence?,
          has_missing_info: proposal.has_missing_info?,
          processing_time_ms: proposal.processing_time_ms,
          rejection_reason: proposal.rejection_reason,
          error_message: proposal.error_message,

          # Email summary (may be nil if email was deleted)
          email: proposal.synced_email ? {
            id: proposal.synced_email.id,
            subject: proposal.synced_email.subject,
            from_email: proposal.synced_email.from_email,
            from_name: proposal.synced_email.from_name,
            received_at: proposal.synced_email.received_at,
            has_attachments: proposal.synced_email.has_attachments,
            attachment_count: proposal.synced_email.attachment_count,
            # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents (WarehouseDocument)
            pdf_count: proposal.synced_email.attachment_documents.joins(:storage_blob).where(storage_blobs: { content_type: "application/pdf" }).count
          } : nil,

          # User info (may be nil for system-created proposals)
          created_by: proposal.created_by_user ? {
            id: proposal.created_by_user.id,
            name: proposal.created_by_user.name,
            email: proposal.created_by_user.email
          } : nil,

          # Job info (if approved)
          job: proposal.job ? {
            id: proposal.job.id,
            title: proposal.job.title
          } : nil,

          # Approved by info (if approved)
          approved_by: proposal.approved_by_user ? {
            id: proposal.approved_by_user.id,
            name: proposal.approved_by_user.name
          } : nil
        }

        # Include full email body if requested
        if include_full_email
          data[:email][:body_text] = proposal.synced_email.body_text
          data[:email][:body_html] = proposal.synced_email.body_html
          data[:email][:preview_body] = proposal.synced_email.preview_body(length: 500)
        end

        data
      end
    end
  end
end
