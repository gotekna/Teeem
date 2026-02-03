module Api
  module V1
    class DirectorOnboardingRequestsController < ApplicationController
      # Skip authentication for public form submission
      skip_before_action :authorize_request, only: [ :show_public, :submit, :upload_document ]

      before_action :set_request, only: [ :show, :update, :destroy, :approve, :reject ]
      before_action :set_public_request, only: [ :show_public, :submit, :upload_document ]

      # GET /api/v1/director_onboarding_requests
      # Admin view - list all requests
      def index
        requests = DirectorOnboardingRequest.includes(:contact, :corporate, :reviewed_by, :invited_by)

        # Filter by status
        if params[:status].present?
          requests = requests.where(status: params[:status])
        end

        # Filter by company
        if params[:company_id].present?
          requests = requests.where(company_id: params[:company_id])
        end

        requests = requests.order(created_at: :desc)

        render json: {
          requests: requests.map { |r| serialize_request(r) },
          stats: {
            pending: DirectorOnboardingRequest.pending.count,
            submitted: DirectorOnboardingRequest.submitted.count,
            approved: DirectorOnboardingRequest.approved.count,
            rejected: DirectorOnboardingRequest.rejected.count
          }
        }
      end

      # GET /api/v1/director_onboarding_requests/:id
      # Admin view - show request details
      def show
        render json: { request: serialize_request(@request, full: true) }
      end

      # GET /api/v1/director_onboarding_requests/public/:access_token
      # Public view - for directors to fill in their details
      def show_public
        unless @request.token_valid?
          render json: { error: "This link has expired" }, status: :gone
          return
        end

        render json: {
          request: {
            id: @request.id,
            status: @request.status,
            company_name: @request.company&.name,
            first_name: @request.first_name,
            last_name: @request.last_name,
            email: @request.email,
            mobile_phone: @request.mobile_phone,
            date_of_birth: @request.date_of_birth,
            place_of_birth: @request.place_of_birth,
            birth_state: @request.birth_state,
            birth_country: @request.birth_country,
            residential_address: @request.residential_address,
            director_id: @request.director_id,
            drivers_licence: @request.drivers_licence,
            drivers_licence_expiry: @request.drivers_licence_expiry,
            passport_number: @request.passport_number,
            passport_expiry: @request.passport_expiry,
            drivers_licence_front_url: @request.drivers_licence_front_url,
            drivers_licence_back_url: @request.drivers_licence_back_url,
            passport_url: @request.passport_url,
            photo_url: @request.photo_url,
            director_id_confirmation_url: @request.director_id_confirmation_url,
            consent_given: @request.consent_given,
            submitted_at: @request.submitted_at
          },
          required_fields: required_fields_config
        }
      end

      # POST /api/v1/director_onboarding_requests
      # Admin action - create new onboarding request and send invitation
      def create
        @request = DirectorOnboardingRequest.new(create_params)
        @request.invited_by = current_user

        if @request.save
          # Send email invitation
          email_result = send_invitation_email(@request)

          render json: {
            request: serialize_request(@request),
            access_url: onboarding_url(@request.access_token),
            email_sent: email_result[:success],
            email_error: email_result[:error]
          }, status: :created
        else
          render json: { errors: @request.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/director_onboarding_requests/:id
      # Admin action - update request details
      def update
        if @request.update(update_params)
          render json: { request: serialize_request(@request) }
        else
          render json: { errors: @request.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/director_onboarding_requests/:id
      # Admin action - delete request
      def destroy
        @request.destroy
        head :no_content
      end

      # POST /api/v1/director_onboarding_requests/public/:access_token/submit
      # Public action - director submits their information
      def submit
        unless @request.token_valid?
          render json: { error: "This link has expired" }, status: :gone
          return
        end

        if @request.submitted?
          render json: { error: "This form has already been submitted" }, status: :unprocessable_entity
          return
        end

        DirectorOnboardingRequest.transaction do
          @request.update!(submit_params)
          @request.submit!(ip_address: request.remote_ip)
        end

        render json: {
          message: "Thank you! Your information has been submitted for review.",
          request: {
            id: @request.id,
            status: @request.status,
            submitted_at: @request.submitted_at
          }
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/director_onboarding_requests/:id/approve
      # Admin action - approve request and create contact
      def approve
        unless @request.submitted?
          render json: { error: "Can only approve submitted requests" }, status: :unprocessable_entity
          return
        end

        @request.approve!(
          reviewer: current_user,
          notes: params[:notes]
        )

        render json: {
          message: "Director onboarding approved",
          request: serialize_request(@request, full: true),
          contact: @request.contact.as_json
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/director_onboarding_requests/:id/reject
      # Admin action - reject request
      def reject
        unless @request.submitted?
          render json: { error: "Can only reject submitted requests" }, status: :unprocessable_entity
          return
        end

        @request.reject!(
          reviewer: current_user,
          notes: params[:notes]
        )

        render json: {
          message: "Director onboarding rejected",
          request: serialize_request(@request)
        }
      end

      # POST /api/v1/director_onboarding_requests/:id/resend_invitation
      # Admin action - resend the invitation email
      def resend_invitation
        @request = DirectorOnboardingRequest.find(params[:id])

        # Extend token expiry
        @request.update!(token_expires_at: 30.days.from_now)

        # Send email invitation
        email_result = send_invitation_email(@request)

        render json: {
          message: "Invitation resent",
          access_url: onboarding_url(@request.access_token),
          email_sent: email_result[:success],
          email_error: email_result[:error]
        }
      end

      # POST /api/v1/director_onboarding_requests/public/:access_token/upload
      # Public action - upload document directly to SharePoint/OneDrive
      def upload_document
        unless @request.token_valid?
          render json: { error: "This link has expired" }, status: :gone
          return
        end

        unless params[:file].present?
          render json: { error: "No file provided" }, status: :bad_request
          return
        end

        unless params[:document_type].present?
          render json: { error: "Document type is required" }, status: :bad_request
          return
        end

        begin
          service = DirectorDocumentUploadService.new
          result = service.upload_document(
            director_name: @request.display_name,
            document_type: params[:document_type],
            file: params[:file]
          )

          if result[:success]
            # Update the request with the document URL
            url_field = document_type_to_field(params[:document_type])
            @request.update!(url_field => result[:web_url]) if url_field

            render json: {
              success: true,
              document_type: params[:document_type],
              url: result[:web_url],
              file_name: result[:name],
              file_size: result[:size]
            }
          else
            render json: { error: result[:error] }, status: :unprocessable_entity
          end
        rescue => e
          Rails.logger.error "Document upload failed: #{e.message}"
          render json: { error: "Upload failed. Please try again." }, status: :internal_server_error
        end
      end

      private

      def set_request
        @request = DirectorOnboardingRequest.find(params[:id])
      end

      def set_public_request
        @request = DirectorOnboardingRequest.find_by!(access_token: params[:access_token])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Invalid or expired link" }, status: :not_found
      end

      def create_params
        params.require(:director_onboarding_request).permit(
          :company_id,
          :first_name,
          :last_name,
          :email,
          :mobile_phone
        )
      end

      def update_params
        params.require(:director_onboarding_request).permit(
          :company_id,
          :first_name,
          :last_name,
          :email,
          :mobile_phone,
          :status
        )
      end

      def submit_params
        params.require(:director_onboarding_request).permit(
          :first_name,
          :last_name,
          :email,
          :mobile_phone,
          :date_of_birth,
          :place_of_birth,
          :birth_state,
          :birth_country,
          :residential_address,
          :director_id,
          :drivers_licence,
          :drivers_licence_expiry,
          :passport_number,
          :passport_expiry,
          :drivers_licence_front_url,
          :drivers_licence_back_url,
          :passport_url,
          :photo_url,
          :director_id_confirmation_url
        )
      end

      def serialize_request(request, full: false)
        data = {
          id: request.id,
          status: request.status,
          first_name: request.first_name,
          last_name: request.last_name,
          display_name: request.display_name,
          email: request.email,
          mobile_phone: request.mobile_phone,
          company_id: request.company_id,
          company_name: request.company&.name,
          compliance_score: request.compliance_score,
          missing_required_fields: request.missing_required_fields,
          token_valid: request.token_valid?,
          submitted_at: request.submitted_at,
          reviewed_at: request.reviewed_at,
          created_at: request.created_at,
          updated_at: request.updated_at
        }

        if full
          data.merge!(
            date_of_birth: request.date_of_birth,
            place_of_birth: request.place_of_birth,
            birth_state: request.birth_state,
            birth_country: request.birth_country,
            residential_address: request.residential_address,
            director_id: request.director_id,
            drivers_licence: request.drivers_licence,
            drivers_licence_expiry: request.drivers_licence_expiry,
            passport_number: request.passport_number,
            passport_expiry: request.passport_expiry,
            drivers_licence_front_url: request.drivers_licence_front_url,
            drivers_licence_back_url: request.drivers_licence_back_url,
            passport_url: request.passport_url,
            photo_url: request.photo_url,
            director_id_confirmation_url: request.director_id_confirmation_url,
            consent_given: request.consent_given,
            consent_given_at: request.consent_given_at,
            consent_ip_address: request.consent_ip_address,
            review_notes: request.review_notes,
            reviewed_by: request.reviewed_by&.as_json(),
            invited_by: request.invited_by&.as_json(),
            contact_id: request.contact_id
          )
        end

        data
      end

      def required_fields_config
        [
          { field: "first_name", label: "First Name", required: true },
          { field: "last_name", label: "Last Name", required: true },
          { field: "email", label: "Email Address", required: true },
          { field: "mobile_phone", label: "Mobile Phone", required: true },
          { field: "date_of_birth", label: "Date of Birth", required: true, type: "date" },
          { field: "place_of_birth", label: "Place of Birth", required: false },
          { field: "birth_state", label: "Birth State", required: false },
          { field: "birth_country", label: "Birth Country", required: false },
          { field: "residential_address", label: "Residential Address", required: true },
          { field: "director_id", label: "Director ID Number", required: true },
          { field: "drivers_licence", label: "Drivers Licence Number", required: true },
          { field: "drivers_licence_expiry", label: "Drivers Licence Expiry Date", required: true, type: "date" },
          { field: "passport_number", label: "Passport Number", required: false },
          { field: "passport_expiry", label: "Passport Expiry Date", required: false, type: "date" },
          { field: "drivers_licence_front_url", label: "Drivers Licence (Front)", required: true, type: "file" },
          { field: "drivers_licence_back_url", label: "Drivers Licence (Back)", required: true, type: "file" },
          { field: "photo_url", label: "Photo", required: true, type: "file" },
          { field: "passport_url", label: "Passport Photo Page", required: false, type: "file" },
          { field: "director_id_confirmation_url", label: "Director ID Confirmation", required: false, type: "file" }
        ]
      end

      def onboarding_url(token)
        # Frontend URL for the public onboarding form
        frontend_host = ENV["FRONTEND_URL"] || (Rails.env.production? ? "https://teeem.vercel.app" : "https://teeemrob.vercel.app")
        "#{frontend_host}/director-onboarding/#{token}"
      end

      def document_type_to_field(document_type)
        mapping = {
          "drivers_licence_front" => :drivers_licence_front_url,
          "drivers_licence_back" => :drivers_licence_back_url,
          "passport" => :passport_url,
          "photo" => :photo_url,
          "director_id_confirmation" => :director_id_confirmation_url
        }
        mapping[document_type]
      end

      def send_invitation_email(onboarding_request)
        return { success: false, error: "No email address" } if onboarding_request.email.blank?

        begin
          # Pass current_user so email shows "User Name via Tekna Homes" as sender
          email_service = DirectorOnboardingEmailService.new(sender: current_user)
          email_service.send_invitation(onboarding_request)
        rescue => e
          Rails.logger.error "Failed to send director onboarding invitation: #{e.message}"
          { success: false, error: e.message }
        end
      end
    end
  end
end
