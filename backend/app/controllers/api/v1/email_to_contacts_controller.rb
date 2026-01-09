# frozen_string_literal: true

module Api
  module V1
    class EmailToContactsController < ApplicationController
      # POST /api/v1/email_to_contacts/analyze
      # Analyzes email data and returns suggestions for contact creation
      #
      # Parameters:
      #   - email_data: Array of email records with from_email, to_emails, cc_emails
      #   - scope: 'current_view' or 'all_history' (optional, defaults to 'current_view')
      #
      # Returns:
      #   - success: Boolean
      #   - emails: Array of email analysis results
      #   - stats: Summary statistics
      def analyze
        email_data = params[:email_data] || []
        scope = params[:scope] || "current_view"

        service = EmailToContactExtractionService.new(user: current_user)
        result = service.extract_and_analyze(email_data, scope: scope)

        render json: result, status: :ok
      rescue StandardError => e
        Rails.logger.error("EmailToContactsController#analyze error: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))

        render json: {
          success: false,
          error: e.message
        }, status: :internal_server_error
      end

      # POST /api/v1/email_to_contacts/bulk_create
      # Creates multiple contacts and companies in bulk
      #
      # Parameters:
      #   - selections: Array of { email:, display_name:, entity_type:, company_action:, company_id:, company_name:, relationship_type:, reason: }
      #   - case_id: Optional case ID to link contacts to (Integer)
      #   - default_relationship_type: Default relationship type if not specified per selection (String)
      #   - default_reason: Default reason if not specified per selection (String)
      #
      # Returns:
      #   - success: Boolean
      #   - created_contacts: Array of created contact objects
      #   - created_companies: Array of created company objects
      #   - linked_to_companies: Array of contact-company links
      #   - linked_to_cases: Array of contact-case links
      #   - errors: Array of error objects
      def bulk_create
        selections = params[:selections] || []
        case_id = params[:case_id]
        default_relationship_type = params[:default_relationship_type]
        default_reason = params[:default_reason]

        if selections.empty?
          return render json: {
            success: false,
            error: "No selections provided"
          }, status: :bad_request
        end

        service = EmailToContactExtractionService.new(user: current_user)
        result = service.bulk_create(
          selections,
          case_id: case_id,
          default_relationship_type: default_relationship_type,
          default_reason: default_reason
        )

        if result[:success]
          render json: result, status: :created
        else
          render json: result, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error("EmailToContactsController#bulk_create error: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))

        render json: {
          success: false,
          error: e.message
        }, status: :internal_server_error
      end
    end
  end
end
