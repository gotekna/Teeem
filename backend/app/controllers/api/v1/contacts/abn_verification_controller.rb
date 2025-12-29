# frozen_string_literal: true

module Api
  module V1
    module Contacts
      # Handles ABN verification and lookup operations
      # Extracted from ContactsController as part of controller decomposition
      # See: ADR-001-CONTACTS-CONTROLLER-DECOMPOSITION.md
      class AbnVerificationController < ApplicationController
        before_action :authorize_request

        # GET /api/v1/contacts/abn/validate?abn=12345678901
        # Validates ABN format (checksum validation)
        def validate
          abn = params[:abn]

          if abn.blank?
            return render json: {
              valid: false,
              error: "ABN is required"
            }
          end

          result = AbnLookupService.validate(abn)
          render json: result
        end

        # POST /api/v1/contacts/abn/:contact_id/verify
        # Verifies contact's ABN via Australian Business Register API
        def verify
          contact = Contact.find(params[:contact_id])

          if contact.abn.blank?
            return render json: {
              success: false,
              error: "Contact has no ABN"
            }, status: :unprocessable_entity
          end

          result = contact.verify_abn!

          render json: {
            success: true,
            data: {
              abn: contact.abn,
              abn_formatted: AbrApiService.format(contact.abn),
              entity_name: result[:entity_name],
              entity_type: result[:entity_type_description],
              entity_type_code: result[:entity_type_code],
              gst_registered: result[:gst_registered],
              valid: result[:valid],
              active: result[:active]
            }
          }
        rescue AbrApiService::AbrError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/abn/find_missing
        # Find and populate missing ABNs by searching company names via ABR API
        def find_missing
          unless ENV["ABR_GUID"].present?
            render json: {
              success: false,
              error: "ABR_GUID environment variable not set. Register at https://abr.business.gov.au"
            }, status: :service_unavailable
            return
          end

          # Run the task in the background using Solid Queue
          FindMissingAbnsJob.perform_later

          render json: {
            success: true,
            message: "ABN search started in background. This may take several minutes."
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end
      end
    end
  end
end
