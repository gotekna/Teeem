module Api
  module V1
    class EmailCaseProposalsController < ApplicationController
      before_action :set_proposal, only: [ :show, :approve, :reject, :re_extract ]

      # GET /api/v1/email_case_proposals
      # List proposals with filtering
      # SSoT (Jan 2026): Tenant scoping via SyncedEmail join
      def index
        # EmailCaseProposal doesn't have acts_as_tenant, so we scope via SyncedEmail
        # SyncedEmail has acts_as_tenant which auto-filters to current_tenant
        tenant_synced_email_ids = SyncedEmail.pluck(:id)
        proposals = EmailCaseProposal
          .where(synced_email_id: tenant_synced_email_ids)
          .includes(:synced_email, :created_by, :approved_by, :case_record)

        # Filter by status (default: all for overview, or specific)
        if params[:status].present? && params[:status] != "all"
          proposals = proposals.where(status: params[:status])
        end

        # Filter by current user's proposals
        if params[:my_proposals] == "true"
          proposals = proposals.for_user(current_user)
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = [ (params[:per_page] || 20).to_i, 100 ].min
        total = proposals.count

        proposals = proposals.recent.offset((page - 1) * per_page).limit(per_page)

        # Get stats (scoped to tenant)
        stats = {
          total: EmailCaseProposal.where(synced_email_id: tenant_synced_email_ids).count,
          pending: EmailCaseProposal.where(synced_email_id: tenant_synced_email_ids).pending.count,
          approved: EmailCaseProposal.where(synced_email_id: tenant_synced_email_ids).approved.count,
          rejected: EmailCaseProposal.where(synced_email_id: tenant_synced_email_ids).rejected.count
        }

        render json: {
          success: true,
          proposals: proposals.map { |p| serialize_proposal(p) },
          stats: stats,
          pagination: {
            page: page,
            per_page: per_page,
            total: total,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/email_case_proposals/:id
      # Get single proposal with full details
      def show
        render json: {
          success: true,
          proposal: serialize_proposal(@proposal, include_full_email: true)
        }
      end

      # POST /api/v1/email_case_proposals
      # Create new proposal from email
      def create
        email = SyncedEmail.find(params[:synced_email_id])

        # Check if email has already been actioned for a case
        if email.match_type == "case_rejected"
          return render json: {
            success: false,
            error: "This email was previously rejected for case creation"
          }, status: :unprocessable_entity
        end

        # Check if proposal already exists for this email
        existing_proposal = EmailCaseProposal.find_by(
          synced_email: email,
          status: [ "pending", "approved" ]
        )

        if existing_proposal
          return render json: {
            success: false,
            error: "Case proposal already exists for this email",
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
          end
        end

        # Create proposal using service
        service = EmailToCaseService.new(email, user: current_user)
        proposal = service.create_case_proposal

        render json: {
          success: true,
          proposal: serialize_proposal(proposal),
          message: "Case proposal created. Confidence: #{(proposal.confidence_score_value * 100).round}%"
        }, status: :created

      rescue EmailToCaseService::RateLimitError => e
        render json: {
          success: false,
          error: e.message
        }, status: :too_many_requests

      rescue StandardError => e
        Rails.logger.error "Case proposal creation error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to create proposal: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/email_case_proposals/:id/approve
      # Approve proposal and create case
      def approve
        unless @proposal.pending?
          return render json: {
            success: false,
            error: "Proposal is not pending (status: #{@proposal.status})"
          }, status: :unprocessable_entity
        end

        # Get user edits from params
        user_edits = (params[:user_edits] || params[:edits] || {}).to_unsafe_h

        # Create case using service
        service = EmailToCaseService.new(@proposal.synced_email, user: current_user)
        case_record = service.approve_proposal(@proposal, user_edits: user_edits)

        render json: {
          success: true,
          case: serialize_case(case_record),
          proposal: serialize_proposal(@proposal.reload),
          message: "Case '#{case_record.title}' created successfully"
        }

      rescue EmailToCaseService::CaseCreationError => e
        render json: {
          success: false,
          error: e.message,
          proposal: serialize_proposal(@proposal.reload)
        }, status: :unprocessable_entity

      rescue StandardError => e
        Rails.logger.error "Case approval error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to create case: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/email_case_proposals/:id/reject
      # Reject proposal
      def reject
        unless @proposal.pending?
          return render json: {
            success: false,
            error: "Proposal is not pending (status: #{@proposal.status})"
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

      # POST /api/v1/email_case_proposals/:id/re_extract
      # Re-extract data from email
      def re_extract
        unless @proposal.pending?
          return render json: {
            success: false,
            error: "Can only re-extract pending proposals (current status: #{@proposal.status})"
          }, status: :unprocessable_entity
        end

        email = @proposal.email_warehouse

        # Sync PDF attachments if needed
        # SSoT: Per-user Outlook credentials removed - uses org credentials
        # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents (WarehouseDocument)
        if email.has_attachments && email.attachment_documents.empty?
          begin
            email.sync_attachments!
          rescue StandardError => e
            Rails.logger.error "Failed to sync attachments during re-extraction: #{e.message}"
          end
        end

        # Re-extract data
        start_time = Time.current
        service = EmailToCaseService.new(email, user: current_user)
        extracted_data = service.extract_case_data

        processing_time = ((Time.current - start_time) * 1000).round

        # Update proposal
        @proposal.update!(
          extracted_data: extracted_data,
          processing_time_ms: processing_time,
          confidence_score: extracted_data["confidence_score"]
        )

        render json: {
          success: true,
          proposal: serialize_proposal(@proposal.reload),
          message: "Proposal re-extracted. Confidence: #{(extracted_data['confidence_score'] * 100).round}%"
        }

      rescue EmailToCaseService::RateLimitError => e
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

      # GET /api/v1/email_case_proposals/relationship_types
      # Get available relationship types for the UI
      def relationship_types
        render json: {
          success: true,
          relationship_types: CaseContact::RELATIONSHIP_TYPES
        }
      end

      private

      def set_proposal
        # SSoT (Jan 2026): Tenant scoping via SyncedEmail join
        tenant_synced_email_ids = SyncedEmail.pluck(:id)
        @proposal = EmailCaseProposal.where(synced_email_id: tenant_synced_email_ids).find(params[:id])
      end

      def serialize_proposal(proposal, include_full_email: false)
        data = {
          id: proposal.id,
          status: proposal.status,
          created_at: proposal.created_at,
          approved_at: proposal.approved_at,
          extracted_data: proposal.extracted_data,
          confidence_score: proposal.confidence_score_value,
          high_confidence: proposal.high_confidence?,
          medium_confidence: proposal.medium_confidence?,
          low_confidence: proposal.low_confidence?,
          has_missing_info: proposal.has_missing_info?,
          processing_time_ms: proposal.processing_time_ms,
          rejection_reason: proposal.rejection_reason,
          error_message: proposal.error_message,
          folder_paths: proposal.folder_paths,

          # Extracted fields for quick access
          case_title: proposal.case_title,
          case_type: proposal.case_type,
          description: proposal.description,
          priority: proposal.priority,
          urgency: proposal.urgency,
          involved_parties: proposal.involved_parties,
          primary_party: proposal.primary_party,
          related_jobs: proposal.related_jobs,
          related_companies: proposal.related_companies,

          # Email summary
          email: {
            id: proposal.synced_email.id,
            subject: proposal.synced_email.subject,
            from_email: proposal.synced_email.from_email,
            from_name: proposal.synced_email.from_name,
            received_at: proposal.synced_email.received_at,
            has_attachments: proposal.synced_email.has_attachments,
            attachment_count: proposal.synced_email.attachment_count,
            conversation_id: proposal.synced_email.conversation_id,
            # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents (WarehouseDocument)
            pdf_count: proposal.synced_email.attachment_documents.joins(:storage_blob).where(storage_blobs: { content_type: "application/pdf" }).count
          },

          # User info
          created_by: proposal.created_by ? {
            id: proposal.created_by.id,
            name: proposal.created_by.name,
            email: proposal.created_by.email
          } : nil,

          # Case info (if approved)
          case_record: proposal.case_record ? {
            id: proposal.case_record.id,
            case_number: proposal.case_record.case_number,
            title: proposal.case_record.title
          } : nil,

          # Approved by info
          approved_by: proposal.approved_by ? {
            id: proposal.approved_by.id,
            name: proposal.approved_by.name
          } : nil
        }

        # Include full email body if requested
        if include_full_email
          data[:email][:body_text] = proposal.synced_email.body_text
          data[:email][:body_html] = proposal.synced_email.body_html
          data[:email][:preview_body] = proposal.synced_email.preview_body(length: 500) if proposal.synced_email.respond_to?(:preview_body)
        end

        data
      end

      def serialize_case(case_record)
        {
          id: case_record.id,
          case_number: case_record.case_number,
          title: case_record.title,
          case_type: case_record.case_type,
          formatted_case_type: case_record.formatted_case_type,
          status: case_record.status,
          priority: case_record.priority,
          created_at: case_record.created_at
        }
      end
    end
  end
end
