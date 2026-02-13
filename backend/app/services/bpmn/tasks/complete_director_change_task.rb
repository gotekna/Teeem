# frozen_string_literal: true

module Bpmn
  module Tasks
    # CompleteDirectorChangeTask - Finalize director changes after e-signing completes
    #
    # Called after WaitForSignaturesTask confirms all signatures are collected.
    # Delegates to DirectorChangeService.complete_signing! to:
    # - Update CorporateDirector records (set resignation_date, create new appointments)
    # - Store the signed PDF as a WarehouseDocument
    #
    class CompleteDirectorChangeTask < BaseTask
      def execute
        raise "Subject must be a Corporate" unless @subject.is_a?(Corporate)

        form_data = @variables["director_change_form"]
        raise "No director change form data in process variables" if form_data.blank?

        log_info("Completing director changes for #{@subject.name}")

        # Find the e-signature request from the signing task result
        esign_result = @variables["esign_result"] || @variables["signing_result"]
        esign_request = find_esign_request(esign_result)
        raise "E-signature request not found" unless esign_request

        # Resolve directors from saved form data
        ceasing = resolve_ceasing_directors(form_data["ceasing_directors"] || [])
        appointments = resolve_new_appointments(form_data["new_appointments"] || [])

        service = DirectorChangeService.new(
          company: @subject,
          ceasing_directors: ceasing,
          new_appointments: appointments,
          user: resolve_user
        )

        service.complete_signing!(esign_request)

        log_info("Director changes completed: #{ceasing.size} ceased, #{appointments.size} appointed")

        {
          success: true,
          directors_updated: true,
          ceased_count: ceasing.size,
          appointed_count: appointments.size,
          e_signature_request_id: esign_request.id
        }
      end

      private

      def find_esign_request(esign_result)
        # Try from stored signing result variable
        if esign_result.is_a?(Hash) && esign_result["request_id"].present?
          return ESignatureRequest.find_by(id: esign_result["request_id"])
        end

        # Fallback: find by subject's most recent completed e-sign request
        @subject.e_signature_requests
          .where(status: "completed")
          .order(completed_at: :desc)
          .first
      rescue NoMethodError
        # Subject might not have e_signature_requests association
        nil
      end

      def resolve_ceasing_directors(ceasing_data)
        ceasing_data.map do |cd|
          corporate_director = CorporateDirector.find_by(id: cd["corporate_director_id"])
          next nil unless corporate_director

          {
            corporate_director: corporate_director,
            positions: Array(cd["positions"]),
            cessation_date: Date.parse(cd["cessation_date"]),
            email: cd["email"],
            address: cd["address"]
          }
        end.compact
      end

      def resolve_new_appointments(appointment_data)
        appointment_data.map do |appt|
          contact = Contact.find_by(id: appt["contact_id"])
          next nil unless contact

          {
            contact: contact,
            positions: Array(appt["positions"]),
            appointment_date: Date.parse(appt["appointment_date"]),
            email: appt["email"],
            address: appt["address"]
          }
        end.compact
      end

      def resolve_user
        triggered_by = @variables["_triggered_by"]
        if triggered_by&.start_with?("manual:") || triggered_by&.start_with?("user:")
          user_id = triggered_by.split(":").last
          return User.find_by(id: user_id) if user_id.present?
        end

        Current.user
      end
    end
  end
end
