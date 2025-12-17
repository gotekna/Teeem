# frozen_string_literal: true

module Bpmn
  module Tasks
    # GenerateAndSendForSigningTask - Generate document from template and send for e-signature
    #
    # This task combines document generation with e-signature in a single workflow step.
    # It generates a document from a template, uploads to SharePoint, creates an
    # e-signature request, and sends it to the specified signers.
    #
    # Config options:
    #   template_id: ID of the DocumentTemplate to use
    #   template_name: Alternative - find template by name (if template_id not provided)
    #   title: Title for the e-signature request (supports interpolation)
    #   description: Description (optional, supports interpolation)
    #   message_to_signers: Custom message for signers (optional, supports interpolation)
    #   signers: Array of signer configs (see below)
    #   signing_order: 0 for parallel, 1+ for sequential (default: 0)
    #   expires_in_days: Days until expiry (default: 30)
    #   destination_folder: Custom SharePoint folder path (optional)
    #   store_as_variable: Variable name to store request info
    #   auto_send: Whether to send immediately (default: true)
    #   extra_data: Additional merge fields (optional)
    #
    # Signer config options:
    #   - contact_key: Key to get contact from job (primary_contact, secondary_contact, client_1, etc.)
    #   - contact_id: Direct contact ID
    #   - name: Signer name (if not using contact)
    #   - email: Signer email (if not using contact)
    #   - role: Role label (client, builder, witness, etc.)
    #   - signing_order: Order for sequential signing
    #
    # Example BPMN config:
    #   {
    #     "template_name": "QBCC Contract",
    #     "title": "Contract for {{job.name}}",
    #     "signers": [
    #       { "contact_key": "primary_contact", "role": "client" },
    #       { "contact_key": "secondary_contact", "role": "client" }
    #     ],
    #     "signing_order": 0,
    #     "store_as_variable": "contract_esign"
    #   }
    #
    class GenerateAndSendForSigningTask < BaseTask
      def execute
        template = find_template
        job = resolve_job

        unless template
          raise "Document template not found"
        end

        unless job
          raise "Job is required for document generation"
        end

        title = get_config("title", interpolate_value: true) || "#{template.name} - #{job.name}"
        log_info("Generating document and sending for signature: #{title}")

        # Build signers
        signers = build_signers(job)

        if signers.empty?
          raise "No signers configured for e-signature request"
        end

        # Execute the service
        service = DocumentEsignService.new(
          template: template,
          job: job,
          signers: signers,
          title: title,
          description: get_config("description", interpolate_value: true),
          message_to_signers: get_config("message_to_signers", interpolate_value: true),
          signing_order: @config["signing_order"] || 0,
          expires_in_days: @config["expires_in_days"] || 30,
          auto_send: @config["auto_send"] != false,
          destination_folder: get_config("destination_folder", interpolate_value: true),
          extra_data: @config["extra_data"] || {}
        )

        result = service.execute!
        request = result[:e_signature_request]

        log_info("Document generated and e-signature request created: #{request.request_number}")
        log_info("Sent to #{request.signers.count} signers") if request.status == "sent"

        # Store in variable if configured
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            request_id: request.id,
            request_number: request.request_number,
            status: request.status,
            signers_count: request.signers.count,
            document_filename: result[:document_filename],
            document_sharepoint_id: result[:document_sharepoint_id]
          })
        end

        {
          success: true,
          request_id: request.id,
          request_number: request.request_number,
          status: request.status,
          signers_count: request.signers.count,
          document_filename: result[:document_filename]
        }
      end

      private

      def find_template
        if @config["template_id"].present?
          DocumentTemplate.find_by(id: @config["template_id"])
        elsif @config["template_name"].present?
          DocumentTemplate.find_by(name: @config["template_name"])
        else
          raise "Either template_id or template_name must be provided"
        end
      end

      def resolve_job
        return @subject if @subject.is_a?(Job)
        @subject.job if @subject.respond_to?(:job)
      end

      def build_signers(job)
        signers_config = @config["signers"]

        # Default to job clients if no signers specified
        if signers_config.blank?
          return job.job_contacts.where(role: "client").includes(:contact).filter_map do |jc|
            next unless jc.contact&.email.present?
            { contact: jc.contact, role: "client" }
          end
        end

        signers_config.filter_map do |signer_config|
          build_signer(job, signer_config)
        end
      end

      def build_signer(job, config)
        if config["contact_key"].present?
          contact = resolve_contact_from_job(job, config["contact_key"])
          return nil unless contact&.email.present?

          {
            contact: contact,
            role: config["role"] || config["contact_key"],
            signing_order: config["signing_order"]
          }
        elsif config["contact_id"].present?
          contact = Contact.find_by(id: config["contact_id"])
          return nil unless contact&.email.present?

          {
            contact: contact,
            role: config["role"] || "signer",
            signing_order: config["signing_order"]
          }
        elsif config["email"].present?
          {
            name: interpolate(config["name"].to_s),
            email: interpolate(config["email"].to_s),
            role: config["role"] || "signer",
            signing_order: config["signing_order"]
          }
        end
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
          job.job_contacts.find_by(role: key)&.contact
        end
      end
    end
  end
end
