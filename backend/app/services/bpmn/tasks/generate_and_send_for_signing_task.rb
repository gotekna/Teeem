# frozen_string_literal: true

module Bpmn
  module Tasks
    # GenerateAndSendForSigningTask - Generate document from template and send for e-signature
    #
    # This task combines document generation with e-signature in a single workflow step.
    # It generates a document from a template, uploads to SharePoint, creates an
    # e-signature request, and sends it to the specified signers.
    #
    # ============================================================================
    # SSoT: Uses TeknaDocumentGenerator for document generation (Dec 2024)
    # ============================================================================
    #
    # Config options:
    #   template_key: Key from TeknaDocumentGenerator::TEMPLATES (SSoT - PREFERRED)
    #                 Examples: "welcome_letter", "specifications", "qbcc_contract"
    #   template_id: DEPRECATED - ID of the DocumentTemplate to use
    #   template_name: DEPRECATED - find template by name
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
    # Example BPMN config (NEW - template_key):
    #   {
    #     "template_key": "welcome_letter",
    #     "title": "Welcome Letter for {{job.name}}",
    #     "signers": [
    #       { "contact_key": "primary_contact", "role": "client" }
    #     ],
    #     "store_as_variable": "welcome_esign"
    #   }
    #
    # Available template_keys (from TeknaDocumentGenerator::TEMPLATES):
    #   - welcome_letter, specifications, colour_selections, owners_authority
    #   - spec_acknowledgement, termite_protection, variation, practical_completion
    #   - qbcc_contract, qbcc_consumer_guide, qbcc_general_conditions
    #   - deposit_claim_invoice, purchase_order
    #
    class GenerateAndSendForSigningTask < BaseTask
      def execute
        job = resolve_job
        template_key = resolve_template_key

        unless job
          raise "Job is required for document generation"
        end

        unless template_key
          raise "template_key is required. Available: #{TeknaDocumentGenerator::TEMPLATES.keys.join(', ')}"
        end

        # Get template config for title
        template_config = TeknaDocumentGenerator::TEMPLATES[template_key]
        template_title = template_config&.dig(:title) || template_key.to_s.titleize

        title = get_config("title", interpolate_value: true) || "#{template_title} - #{job.name}"
        log_info("Generating document and sending for signature: #{title}")

        # Get workflow-level signing config (SSoT)
        workflow_signing = workflow_signing_config

        # Build signers (workflow-level first, then task-level for backwards compat)
        signers = build_signers(job, workflow_signing)

        if signers.empty?
          raise "No signers configured for e-signature request"
        end

        # Get additional documents from workflow config
        additional_docs = workflow_signing["additional_documents"] || []
        log_info("Document package: 1 main + #{additional_docs.length} additional documents")

        # Execute the service using template_key (SSoT)
        service = DocumentEsignService.new(
          template_key: template_key,
          job: job,
          signers: signers,
          title: title,
          description: get_config("description", interpolate_value: true),
          message_to_signers: get_config("message_to_signers", interpolate_value: true),
          signing_order: workflow_signing["signing_order"] || @config["signing_order"] || 0,
          expires_in_days: workflow_signing["expires_in_days"] || @config["expires_in_days"] || 30,
          auto_send: @config["auto_send"] != false,
          destination_folder: get_config("destination_folder", interpolate_value: true),
          extra_data: @config["extra_data"] || {},
          additional_templates: additional_docs.filter_map { |doc| doc["template_key"] }
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

      # Resolve template_key from config
      # SSoT: Prefers template_key, falls back to mapping template_name for backwards compatibility
      def resolve_template_key
        # Direct template_key (preferred)
        if @config["template_key"].present?
          key = @config["template_key"].to_sym
          unless TeknaDocumentGenerator::TEMPLATES.key?(key)
            raise "Unknown template_key: #{key}. Available: #{TeknaDocumentGenerator::TEMPLATES.keys.join(', ')}"
          end
          return key
        end

        # DEPRECATED: Map template_name to template_key for backwards compatibility
        if @config["template_name"].present?
          name = @config["template_name"].to_s
          key = map_template_name_to_key(name)
          if key
            log_info("DEPRECATED: Mapped template_name '#{name}' to template_key '#{key}'. Update workflow to use template_key directly.")
            return key
          else
            raise "Could not map template_name '#{name}' to a template_key. Available: #{TeknaDocumentGenerator::TEMPLATES.keys.join(', ')}"
          end
        end

        # DEPRECATED: template_id is no longer supported
        if @config["template_id"].present?
          raise "template_id is deprecated. Use template_key instead. Available: #{TeknaDocumentGenerator::TEMPLATES.keys.join(', ')}"
        end

        nil
      end

      # Map old template names to new template keys
      # This provides backwards compatibility for existing workflows
      TEMPLATE_NAME_MAP = {
        # Exact matches
        "Welcome Letter" => :welcome_letter,
        "Specifications" => :specifications,
        "Colour Selections" => :colour_selections,
        "Owner's Authority to Obtain Information" => :owners_authority,
        "Owners Authority to Obtain Information" => :owners_authority,
        "Specification of Works Acknowledgement" => :spec_acknowledgement,
        "Termite Protection System" => :termite_protection,
        "Contract Variation" => :variation,
        "Practical Completion Certificate" => :practical_completion,
        "QBCC Contract" => :qbcc_contract,
        "QBCC Building Contract" => :qbcc_contract,
        "QBCC Consumer Building Guide" => :qbcc_consumer_guide,
        "QBCC General Conditions" => :qbcc_general_conditions,
        "QBCC General Conditions of Contract" => :qbcc_general_conditions,
        "Deposit Claim Invoice" => :deposit_claim_invoice,
        "Purchase Order" => :purchase_order
      }.freeze

      def map_template_name_to_key(name)
        # Try exact match first
        return TEMPLATE_NAME_MAP[name] if TEMPLATE_NAME_MAP.key?(name)

        # Try case-insensitive match
        TEMPLATE_NAME_MAP.each do |template_name, key|
          return key if template_name.downcase == name.downcase
        end

        # Try converting name to key format (snake_case)
        possible_key = name.parameterize(separator: "_").to_sym
        return possible_key if TeknaDocumentGenerator::TEMPLATES.key?(possible_key)

        nil
      end

      def resolve_job
        return @subject if @subject.is_a?(Job)
        @subject.job if @subject.respond_to?(:job)
      end

      # Get workflow-level signing config from process canvas_data
      def workflow_signing_config
        return {} unless @instance&.bpmn_process

        canvas_data = @instance.bpmn_process.canvas_data || {}
        canvas_data["signing_config"] || {}
      end

      def build_signers(job, workflow_signing = {})
        # Priority: workflow-level signers (SSoT) > task-level signers > job clients default
        signers_config = workflow_signing["signers"].presence || @config["signers"]

        # Default to job clients if no signers specified
        if signers_config.blank?
          return job.job_contacts.where(role: "client").includes(:contact).filter_map do |jc|
            next unless jc.contact&.email.present?
            { contact: jc.contact, role: "client" }
          end
        end

        signers_config.filter_map do |signer_config|
          build_signer(job, signer_config.with_indifferent_access)
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
