module Api
  module V1
    class CompanyDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :download, :preview, :validate, :ai_verify, :apply_ai_suggestion, :relocate, :feedback]

      # GET /api/v1/company_documents
      def index
        @documents = CompanyDocument.includes(:company, :user, :asset).all

        # Filter by company
        @documents = @documents.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by contact (for family member documents)
        @documents = @documents.where(contact_id: params[:contact_id]) if params[:contact_id].present?

        # Filter by asset
        @documents = @documents.by_asset(params[:asset_id]) if params[:asset_id].present?

        # Filter by with/without asset
        @documents = @documents.with_asset if params[:with_asset] == 'true'
        @documents = @documents.without_asset if params[:without_asset] == 'true'

        # Filter by type
        @documents = @documents.by_type(params[:document_type]) if params[:document_type].present?

        # Filter by tab
        @documents = @documents.by_tab(params[:tab]) if params[:tab].present?

        # Filter by source (manual, xero, sharepoint)
        @documents = @documents.by_source(params[:source]) if params[:source].present?

        # Filter by year
        @documents = @documents.by_year(params[:year]) if params[:year].present?

        # Filter by financial year (supports documents spanning multiple years)
        @documents = @documents.by_financial_year(params[:financial_year]) if params[:financial_year].present?

        # Sort
        @documents = @documents.order(created_at: :desc)

        render json: {
          success: true,
          documents: @documents.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] },
              asset: { only: [:id, :name, :description, :abbreviation], methods: [:display_name] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # GET /api/v1/company_documents/:id
      def show
        render json: {
          success: true,
          document: @document.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] },
              asset: { only: [:id, :name, :description, :abbreviation], methods: [:display_name] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # POST /api/v1/company_documents
      def create
        @document = CompanyDocument.new(document_params)
        @document.user = current_user

        # Handle file upload via Active Storage
        if params[:file].present?
          @document.file.attach(params[:file])
          @document.file_name = params[:file].original_filename
          @document.file_size = params[:file].size
          @document.mime_type = params[:file].content_type
        end

        if @document.save
          render json: {
            success: true,
            message: 'Document uploaded successfully',
            document: @document.as_json(methods: [:formatted_document_type])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/company_documents/:id
      def update
        if @document.update(document_params)
          render json: {
            success: true,
            message: 'Document updated successfully',
            document: @document.as_json(methods: [:formatted_document_type])
          }
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_documents/:id
      def destroy
        @document.destroy
        render json: {
          success: true,
          message: 'Document deleted successfully'
        }
      end

      # GET /api/v1/company_documents/:id/download
      def download
        if @document.file.attached?
          redirect_to rails_blob_path(@document.file, disposition: "attachment")
        elsif @document.file_url.present?
          redirect_to @document.file_url
        else
          render json: {
            success: false,
            error: 'No file available for download'
          }, status: :not_found
        end
      end

      # GET /api/v1/company_documents/:id/content
      # Proxies the actual file content from OneDrive (for PDF editor CORS bypass)
      def content
        unless @document.onedrive_file_id.present?
          return render json: {
            success: false,
            error: 'No OneDrive file available'
          }, status: :unprocessable_entity
        end

        begin
          credential = OrganizationOneDriveCredential.active_credential
          unless credential
            return render json: {
              success: false,
              error: 'OneDrive credentials not available in this environment'
            }, status: :service_unavailable
          end

          client = MicrosoftGraphClient.new(credential)
          file_content = client.download_file(@document.onedrive_file_id)

          # Determine content type from file extension
          content_type = case @document.file_name&.downcase
          when /\.pdf$/
            'application/pdf'
          when /\.png$/
            'image/png'
          when /\.jpe?g$/
            'image/jpeg'
          when /\.gif$/
            'image/gif'
          when /\.docx?$/
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          when /\.xlsx?$/
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          else
            'application/octet-stream'
          end

          # Set CORS headers for frontend access
          response.headers['Access-Control-Allow-Origin'] = request.headers['Origin'] || '*'
          response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
          response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'

          send_data file_content,
            type: content_type,
            disposition: 'inline',
            filename: @document.file_name
        rescue MicrosoftGraphClient::APIError => e
          render json: {
            success: false,
            error: "Failed to fetch file: #{e.message}"
          }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Document content fetch error: #{e.message}"
          render json: {
            success: false,
            error: 'Failed to fetch document content'
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/company_documents/:id/preview
      # Returns an embeddable preview URL for OneDrive files
      def preview
        unless @document.onedrive_file_id.present?
          return render json: {
            success: false,
            error: 'No OneDrive file available for preview',
            fallback_url: @document.file_url
          }, status: :unprocessable_entity
        end

        begin
          # Get the active OneDrive credential (corporate SharePoint)
          credential = OrganizationOneDriveCredential.active_credential
          unless credential
            return render json: {
              success: false,
              error: 'OneDrive not configured',
              fallback_url: @document.file_url
            }, status: :unprocessable_entity
          end

          client = MicrosoftGraphClient.new(credential)
          preview_url = client.get_preview_url(@document.onedrive_file_id)

          if preview_url
            render json: {
              success: true,
              preview_url: preview_url,
              file_name: @document.file_name,
              file_type: @document.file_name&.split('.')&.last&.downcase
            }
          else
            render json: {
              success: false,
              error: 'Preview not available for this file type',
              fallback_url: @document.file_url
            }, status: :unprocessable_entity
          end
        rescue MicrosoftGraphClient::AuthenticationError => e
          Rails.logger.error "OneDrive auth error getting preview: #{e.message}"
          render json: {
            success: false,
            error: 'OneDrive authentication error',
            fallback_url: @document.file_url
          }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          Rails.logger.error "OneDrive API error getting preview: #{e.message}"
          render json: {
            success: false,
            error: 'Failed to get preview from OneDrive',
            fallback_url: @document.file_url
          }, status: :unprocessable_entity
        rescue ActiveRecord::Encryption::Errors::Decryption => e
          Rails.logger.error "OneDrive credential decryption error: #{e.message}"
          render json: {
            success: false,
            error: 'OneDrive credentials not available in this environment',
            fallback_url: @document.file_url
          }, status: :service_unavailable
        end
      end

      # POST /api/v1/company_documents/:id/validate
      # User validates that the document naming is correct
      def validate
        @document.update!(
          user_validated_at: Time.current,
          user_validated_by: current_user,
          validation_required: false,
          ai_verification_status: 'verified'
        )

        render json: {
          success: true,
          message: 'Document validated successfully',
          document: @document.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # POST /api/v1/company_documents/:id/ai_verify
      # Triggers AI analysis of document naming
      def ai_verify
        # Check if OneDrive file exists
        unless @document.onedrive_file_id.present?
          return render json: {
            success: false,
            error: 'No OneDrive file available for this document'
          }, status: :unprocessable_entity
        end

        # Mark as processing immediately for UI feedback
        @document.update!(ai_verification_status: 'processing')

        # Queue background job
        DocumentVerificationJob.perform_later(@document.id)

        render json: {
          success: true,
          message: 'AI verification started',
          document_id: @document.id,
          status: 'processing'
        }
      end

      # POST /api/v1/company_documents/:id/apply_ai_suggestion
      # Renames document to the AI-suggested name
      def apply_ai_suggestion
        unless @document.ai_suggested_name.present?
          return render json: {
            success: false,
            error: 'No AI suggestion available'
          }, status: :unprocessable_entity
        end

        old_title = @document.title
        @document.update!(
          title: @document.ai_suggested_name,
          ai_verification_status: 'verified',
          user_validated_at: Time.current,
          user_validated_by: current_user
        )

        render json: {
          success: true,
          message: "Document renamed from '#{old_title}' to '#{@document.title}'",
          document: @document.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # POST /api/v1/company_documents/:id/feedback
      # Records user feedback on AI suggestion for re-learning
      def feedback
        feedback_params = params.require(:feedback).permit(
          :action, :final_name, :final_folder, :final_type, :final_fy, :reason
        )

        # Validate action type
        unless %w[accepted rejected modified].include?(feedback_params[:action])
          return render json: {
            success: false,
            error: "Invalid action. Must be 'accepted', 'rejected', or 'modified'."
          }, status: :unprocessable_entity
        end

        # Create feedback record
        feedback = DocumentVerificationFeedback.create!(
          company_document: @document,
          user: current_user,
          # What AI suggested
          ai_suggested_name: @document.ai_suggested_name,
          ai_suggested_folder: @document.ai_suggested_folder,
          ai_suggested_type: @document.ai_suggested_type,
          ai_suggested_fy: @document.ai_suggested_fy,
          ai_confidence: @document.ai_confidence_score,
          # What user chose
          user_final_name: feedback_params[:final_name] || @document.title,
          user_final_folder: feedback_params[:final_folder] || @document.folder,
          user_final_type: feedback_params[:final_type] || @document.document_type,
          user_final_fy: feedback_params[:final_fy],
          # Feedback metadata
          action: feedback_params[:action],
          rejection_reason: feedback_params[:reason],
          # Context for learning
          document_text_snippet: @document.extracted_text&.first(500),
          company_code: @document.company&.code
        )

        render json: {
          success: true,
          message: 'Feedback recorded for AI learning',
          feedback_id: feedback.id
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # POST /api/v1/company_documents/:id/relocate
      # Moves/renames document in OneDrive and updates metadata
      def relocate
        relocate_params = params.require(:relocate).permit(:title, :company_id, :folder, :document_type, :ref_date, :filed_date, :notes, financial_years: [])

        # Capture old values for activity log
        old_values = {
          title: @document.title,
          company_id: @document.company_id,
          folder: @document.folder,
          document_type: @document.document_type,
          financial_years: @document.financial_years
        }

        service = DocumentRelocateService.new(@document)
        result = service.relocate!(
          new_company_id: relocate_params[:company_id],
          new_folder: relocate_params[:folder],
          new_title: relocate_params[:title]
        )

        if result[:success]
          # Update additional fields not handled by relocate service
          updates = {}
          updates[:financial_years] = relocate_params[:financial_years] if relocate_params[:financial_years].present?
          updates[:document_type] = relocate_params[:document_type] if relocate_params[:document_type].present?
          updates[:ref_date] = relocate_params[:ref_date] if relocate_params[:ref_date].present?
          updates[:filed_date] = relocate_params[:filed_date] if relocate_params[:filed_date].present?
          @document.update!(updates) if updates.any?

          @document.reload

          # Log activity - determine action type based on what changed
          new_values = {
            title: @document.title,
            company_id: @document.company_id,
            folder: @document.folder,
            document_type: @document.document_type,
            financial_years: @document.financial_years
          }

          # Determine action type
          action = if old_values[:company_id] != new_values[:company_id] || old_values[:folder] != new_values[:folder]
                     "moved"
                   elsif old_values[:title] != new_values[:title]
                     "renamed"
                   else
                     "updated"
                   end

          # Create activity log entry - use user-provided notes if available, otherwise use automated action summary
          DocumentActivity.log(
            document: @document,
            user: current_user,
            action: action,
            old_values: old_values,
            new_values: new_values,
            notes: relocate_params[:notes].presence || result[:actions]&.join(", ")
          )

          render json: {
            success: true,
            message: result[:message] || 'Document relocated successfully',
            skipped: result[:skipped],
            actions: result[:actions],
            document: @document.as_json(
              include: {
                company: { only: [:id, :name, :code] },
                user: { only: [:id, :name, :email] }
              },
              methods: [:formatted_document_type, :file_size_mb]
            )
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      private

      def set_document
        @document = CompanyDocument.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Document not found' }, status: :not_found
      end

      def document_params
        params.require(:company_document).permit(
          :company_id, :contact_id, :asset_id, :document_type_id, :title, :document_name,
          :document_type, :description, :file_url, :year, :period, :folder,
          :storage_type, :source, :file_name, :file_size, :mime_type,
          :ref_date, :filed_date,
          financial_years: []
        )
      end
    end
  end
end
