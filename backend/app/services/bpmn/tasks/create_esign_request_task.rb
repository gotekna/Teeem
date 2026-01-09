module Bpmn
  module Tasks
    # CreateEsignRequestTask - Create an e-signature request and send for signing
    #
    # Config options:
    #   title: Title of the signing request (supports interpolation)
    #   description: Description (optional, supports interpolation)
    #   document_file_id: SharePoint file ID of document to sign
    #   site_id: SharePoint site ID
    #   drive_id: SharePoint drive ID
    #   signers: Array of signer configs:
    #     - name: Signer name (or use contact_key)
    #     - email: Signer email (or use contact_key)
    #     - role: Signer role (client, builder, witness, etc.)
    #     - contact_key: Key to get contact from job (primary_contact, secondary_contact, etc.)
    #   signing_order: 0 for parallel, 1+ for sequential
    #   expires_in_days: Number of days until expiry (default 30)
    #   message_to_signers: Custom message (optional)
    #   store_as_variable: Variable name to store request ID
    #   auto_send: Whether to send immediately (default true)
    #
    class CreateEsignRequestTask < BaseTask
      def execute
        title = get_config("title", interpolate_value: true) || "Document for Signing"
        description = get_config("description", interpolate_value: true)

        log_info("Creating e-signature request: #{title}")

        # Build signers from config
        signers_data = build_signers_data

        if signers_data.empty?
          raise "No signers configured for e-signature request"
        end

        # Create the request
        request = ESignatureRequest.new(
          title: title,
          description: description,
          documentable: @subject,
          created_by_id: Current.user&.id,
          signing_order: @config["signing_order"] || 0,
          expires_at: (@config["expires_in_days"] || 30).days.from_now,
          message_to_signers: get_config("message_to_signers", interpolate_value: true),
          original_sharepoint_file_id: @config["document_file_id"],
          sharepoint_site_id: @config["site_id"],
          sharepoint_drive_id: @config["drive_id"],
          send_reminders: @config["send_reminders"] != false
        )

        # Add signers
        signers_data.each_with_index do |signer_data, index|
          request.signers.build(
            name: signer_data[:name],
            email: signer_data[:email],
            role: signer_data[:role],
            signing_order: signer_data[:signing_order] || index,
            contact_id: signer_data[:contact_id]
          )
        end

        # Calculate document hash
        if request.original_sharepoint_file_id.present?
          request.original_document_hash = calculate_document_hash(request)
        end

        request.save!

        log_info("E-signature request created: #{request.request_number}")

        # Auto-send if configured
        if @config["auto_send"] != false
          request.send_for_signing!
          log_info("E-signature request sent to #{request.signers.count} signers")
        end

        # Store request ID in variable
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            request_id: request.id,
            request_number: request.request_number,
            status: request.status,
            signers_count: request.signers.count
          })
        end

        {
          success: true,
          request_id: request.id,
          request_number: request.request_number,
          status: request.status,
          signers_count: request.signers.count
        }
      end

      private

      def build_signers_data
        signers_config = @config["signers"] || []
        job = resolve_job

        signers_config.map do |signer_config|
          if signer_config["contact_key"].present? && job
            contact = resolve_contact_from_job(job, signer_config["contact_key"])
            next nil unless contact

            {
              name: contact.display_name,
              email: contact.email,
              role: signer_config["role"] || signer_config["contact_key"],
              signing_order: signer_config["signing_order"],
              contact_id: contact.id
            }
          else
            {
              name: interpolate(signer_config["name"].to_s),
              email: interpolate(signer_config["email"].to_s),
              role: signer_config["role"],
              signing_order: signer_config["signing_order"],
              contact_id: nil
            }
          end
        end.compact
      end

      def resolve_job
        return @subject if @subject.is_a?(Job)
        @subject.job if @subject.respond_to?(:job)
      end

      def resolve_contact_from_job(job, key)
        case key.to_s
        when "primary_contact", "client_1", "buyer_1"
          job.primary_contact
        when "secondary_contact", "client_2", "buyer_2"
          job.secondary_contact
        when "builder", "builder_contact"
          job.builder_contact
        else
          job.contacts.find_by(role: key)
        end
      end

      def calculate_document_hash(request)
        return nil unless request.original_sharepoint_file_id.present?

        begin
          client = MicrosoftAppGraphClient.new
          content = client.get_drive_item_content(
            site_id: request.sharepoint_site_id,
            drive_id: request.sharepoint_drive_id,
            item_id: request.original_sharepoint_file_id
          )
          Digest::SHA256.hexdigest(content)
        rescue StandardError => e
          log_error("Failed to calculate document hash: #{e.message}")
          nil
        end
      end
    end
  end
end
