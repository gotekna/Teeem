# frozen_string_literal: true

module Bpmn
  module Tasks
    # CreateDirectorChangeEsignTask - Create e-signature request for director change package
    #
    # Specialized version of CreateEsignRequestTask that builds signers from the
    # director_change_form process variable (ceasing directors + new appointments).
    # Uses the blob stored by DirectorChangeTask.
    #
    # Process variables read:
    #   director_change_blob_id  - StorageBlob ID from DirectorChangeTask
    #   director_change_form     - Form data with ceasing_directors/new_appointments
    #   director_change_filename - PDF filename
    #
    # Process variables set:
    #   esign_result - { request_id, request_number, status, signers_count }
    #
    class CreateDirectorChangeEsignTask < BaseTask
      def execute
        raise "Subject must be a Corporate" unless @subject.is_a?(Corporate)

        blob_id = @variables["director_change_blob_id"]
        form_data = @variables["director_change_form"]

        raise "No director change blob found" unless blob_id.present?
        raise "No director change form data found" unless form_data.present?

        blob = StorageBlob.find(blob_id)
        log_info("Creating e-signature request for director change package (blob: #{blob.id})")

        # Build signers from form data
        signers_data = build_signers_from_form(form_data)
        raise "No signers found for e-signature request" if signers_data.empty?

        # Create the request using DirectorChangeService pattern
        pdf_content = blob.download
        request = ESignatureRequest.create!(
          title: "Director Change - #{@subject.name}",
          documentable: @subject,
          created_by: resolve_user,
          document_type: DocumentType.find_by(abbreviation: "F484"),
          signing_order: ESignatureRequest::SIGNING_ORDERS[:sequential],
          send_reminders: true,
          original_document_hash: Digest::SHA256.hexdigest(pdf_content)
        )

        request.set_original_storage_reference(blob.id.to_s)
        request.save!

        # Add signers
        signers_data.each do |signer|
          request.signers.create!(
            name: signer[:name],
            email: signer[:email],
            contact_id: signer[:contact_id],
            role: "director",
            signing_order: signer[:signing_order]
          )
        end

        # Create signature fields from metadata (deterministic page order)
        create_fields_from_metadata(request, form_data)

        # Auto-send for signing (system-generated PDFs have known field positions)
        request.send_for_signing!
        log_info("E-signature request sent: #{request.request_number} with #{signers_data.size} signers")

        # Store result for WaitForSignaturesTask
        result = {
          "request_id" => request.id,
          "request_number" => request.request_number,
          "status" => request.status,
          "signers_count" => signers_data.size
        }

        store_variable = get_config("store_as_variable", interpolate_value: false) || "esign_result"
        set_variable(store_variable, result)

        {
          success: true,
          request_id: request.id,
          request_number: request.request_number,
          signers_count: signers_data.size
        }
      end

      private

      # Create ESignatureField records at known positions for each signing page.
      # Uses the same deterministic document order as DirectorChangeService.
      # Each template type has different signature positions (see BADGE_POSITIONS).
      def create_fields_from_metadata(request, form_data)
        signers = request.signers.order(:signing_order).to_a
        return if signers.empty?

        # Build contact_id → signer lookup
        signer_by_contact_id = {}
        signers.each { |s| signer_by_contact_id[s.contact_id] = s }

        page_map = {}
        current_page = 1

        # Page 1: Minutes → chairperson (first ceasing director = first signer)
        page_map[current_page] = { signer: signers.first, template: :minutes }
        current_page += 1

        # Resignations: one page per position per ceasing director
        (form_data["ceasing_directors"] || []).each do |cd|
          director = CorporateDirector.find_by(id: cd["corporate_director_id"])
          next unless director

          signer = signer_by_contact_id[director.contact_id]
          next unless signer

          positions = cd["positions"] || []
          positions.each do |_pos|
            page_map[current_page] = { signer: signer, template: :resignation }
            current_page += 1
          end
        end

        # Consents: one page per position per new appointment
        (form_data["new_appointments"] || []).each do |appt|
          contact = Contact.find_by(id: appt["contact_id"])
          next unless contact

          signer = signer_by_contact_id[contact.id]
          next unless signer

          positions = appt["positions"] || []
          positions.each do |_pos|
            page_map[current_page] = { signer: signer, template: :consent }
            current_page += 1
          end
        end

        # Create fields using per-template badge positions
        page_map.each do |page_number, entry|
          signer = entry[:signer]
          pos = DirectorChangeService::BADGE_POSITIONS[entry[:template]] || DirectorChangeService::BADGE_POSITIONS[:resignation]

          request.fields.create!(
            e_signature_signer: signer,
            field_type: "signature",
            page_number: page_number,
            x_percent: pos[:x_percent],
            y_percent: pos[:y_percent],
            width_percent: pos[:width_percent],
            height_percent: pos[:height_percent],
            label: "Signature - #{signer.name}",
            required: true
          )
        end
      end

      def build_signers_from_form(form_data)
        signers = []
        signing_order = 0

        # Ceasing directors sign resignation letters
        (form_data["ceasing_directors"] || []).each do |cd|
          director = CorporateDirector.find_by(id: cd["corporate_director_id"])
          next unless director

          contact = director.contact
          email = cd["email"].presence || contact.primary_email
          next unless email.present?

          signing_order += 1
          signers << {
            name: contact.display_name,
            email: email,
            contact_id: contact.id,
            signing_order: signing_order
          }
        end

        # New appointments sign consent to act
        (form_data["new_appointments"] || []).each do |appt|
          contact = Contact.find_by(id: appt["contact_id"])
          next unless contact

          email = appt["email"].presence || contact.primary_email
          next unless email.present?

          signing_order += 1
          signers << {
            name: contact.display_name,
            email: email,
            contact_id: contact.id,
            signing_order: signing_order
          }
        end

        signers
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
