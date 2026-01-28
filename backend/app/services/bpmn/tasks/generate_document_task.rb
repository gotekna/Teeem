module Bpmn
  module Tasks
    # GenerateDocumentTask - Generate documents from templates (Word, HTML, PDF)
    #
    # Config options:
    #   template_id: ID of DocumentTemplate to use
    #   template_name: Name of template (alternative to ID)
    #   output_filename: Override filename pattern (optional)
    #   destination_folder: SharePoint folder path for upload (optional)
    #   store_as_variable: Variable name to store result (optional)
    #   contact_id: Specific contact ID to use (optional)
    #   attach_to_job: Whether to create JobDocument record (optional)
    #
    # Subject: Job (required) - The job to generate document for
    #
    # Supports multiple template types via UnifiedDocumentGenerator:
    #   - html: Local HTML/ERB templates with Grover PDF conversion
    #   - pdf_overlay: PDF form filling (future HIA support)
    #
    # Note: Word templates were removed in December 2024.
    # Use TeknaDocumentGenerator for new document generation.
    #
    class GenerateDocumentTask < BaseTask
      def execute
        template = resolve_template
        raise "No template specified (provide template_id or template_name)" unless template

        log_info("Generating document from template '#{template.name}' (#{template.category}, type: #{template.template_type})")

        # Get job and contact from subject/config
        job = resolve_job
        contact = resolve_contact

        # Create unified generator - routes to appropriate engine based on template_type
        generator = UnifiedDocumentGenerator.new(template)

        result = if destination_folder.present?
                   generator.generate_and_upload(
                     job: job,
                     contact: contact,
                     extra_data: build_extra_data,
                     destination_folder: destination_folder
                   )
        else
                   generator.generate(
                     job: job,
                     contact: contact,
                     extra_data: build_extra_data
                   )
        end

        # Create JobDocument record if configured
        if @config["attach_to_job"] && job && result[:uploaded_files]&.any?
          create_job_documents(job, result[:uploaded_files])
        end

        # Store result in variable
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            template_id: template.id,
            template_name: template.name,
            template_type: template.template_type,
            filename: result[:filename],
            pdf_filename: result[:pdf_filename] || result[:filename],
            generated_at: result[:generated_at]&.iso8601 || Time.current.iso8601,
            uploaded_files: result[:uploaded_files]&.map { |f| f.slice(:id, :name, :web_url, :type) }
          })
        end

        log_info("Document generated: #{result[:filename]} (#{template.template_type})")

        {
          success: true,
          template_id: template.id,
          template_name: template.name,
          template_type: template.template_type,
          filename: result[:filename],
          pdf_filename: result[:pdf_filename] || result[:filename],
          generated_at: result[:generated_at]&.iso8601 || Time.current.iso8601,
          uploaded_files: result[:uploaded_files]&.map { |f| f.slice(:id, :name, :web_url, :type) }
        }
      rescue UnifiedDocumentGenerator::CredentialError => e
        log_error("Credential error: #{e.message}")
        raise
      rescue UnifiedDocumentGenerator::GenerationError, UnifiedDocumentGenerator::TemplateError => e
        log_error("Document generation failed: #{e.message}")
        raise
      rescue UnifiedDocumentGenerator::UnsupportedTypeError => e
        log_error("Unsupported template type: #{e.message}")
        raise
      end

      private

      def resolve_template
        # First try by ID
        if @config["template_id"].present?
          template = DocumentTemplate.find_by(id: @config["template_id"])
          return template if template
        end

        # Then try by name (supports imported BPMN workflows)
        if @config["template_name"].present?
          template = DocumentTemplate.find_by(name: @config["template_name"])
          return template if template
        end

        # Check for Compoza-style task_type
        if @config["task_type"] == "generate_document"
          # Try to find template by looking up from Compoza config
          # The template_name might be stored differently in Compoza imports
          if @config["output_filename"].present?
            # Extract template name from output filename pattern
            name_match = @config["output_filename"].match(/- (.+?)(?:\s*-|\.)/)
            if name_match
              template = DocumentTemplate.find_by(name: name_match[1])
              return template if template
            end
          end
        end

        nil
      end

      def resolve_job
        # Subject is typically a Job
        return @subject if @subject.is_a?(Job)

        # Try to get job from subject association
        return @subject.job if @subject.respond_to?(:job) && @subject.job

        # Try from config
        if @config["job_id"]
          return Job.find_by(id: @config["job_id"])
        end

        # Try from variables
        if @variables["job_id"]
          return Job.find_by(id: @variables["job_id"])
        end

        nil
      end

      def resolve_contact
        # From explicit config
        if @config["contact_id"]
          return Contact.find_by(id: @config["contact_id"])
        end

        # From config key (e.g., "primary_contact", "client_1")
        if @config["contact_key"]
          job = resolve_job
          return resolve_contact_from_job(job, @config["contact_key"]) if job
        end

        # From variables
        if @variables["contact_id"]
          return Contact.find_by(id: @variables["contact_id"])
        end

        # Default to job's primary contact
        job = resolve_job
        job&.primary_contact
      end

      def resolve_contact_from_job(job, key)
        case key
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

      def destination_folder
        return nil unless @config["destination_folder"]

        interpolate_string(@config["destination_folder"])
      end

      def build_extra_data
        extra = {}

        # Add all variables
        @variables.each do |key, value|
          extra[key.to_sym] = value
        end

        # Add explicit data mappings
        if @config["data_mappings"]
          @config["data_mappings"].each do |target_key, source_path|
            extra[target_key.to_sym] = resolve_nested_value(source_path)
          end
        end

        extra
      end

      def resolve_nested_value(path)
        parts = path.split(".")
        current = nil

        parts.each_with_index do |part, index|
          current = if index.zero?
                      case part
                      when "subject" then @subject
                      when "variables" then @variables
                      when "job" then resolve_job
                      when "contact" then resolve_contact
                      else @variables[part]
                      end
          elsif current.respond_to?(part)
                      current.send(part)
          elsif current.is_a?(Hash)
                      current[part] || current[part.to_sym]
          else
                      nil
          end
          break if current.nil?
        end

        current
      end

      def interpolate_string(str)
        return str unless str.is_a?(String)

        str.gsub(/\{([^}]+)\}/) do |match|
          path = Regexp.last_match(1)
          resolve_nested_value(path).to_s
        end
      end

      def create_job_documents(job, uploaded_files)
        uploaded_files.each do |file|
          next unless file[:web_url]

          # Create JobDocument record if the model exists
          if defined?(JobDocument)
            job_doc = JobDocument.create(
              job: job,
              file_name: file[:name],
              file_type: "generated",
              web_url: file[:web_url]
            )

            # Dual-write: Create WarehouseDocument for File Warehouse
            if job_doc.persisted?
              WarehouseDocument.create(
                documentable: job_doc,
                source_type: "job",
                display_name: file[:name],
                original_filename: file[:name],
                linkable: job,
                metadata: { job_code: job.job_code, source: "generated" }
              )
            end
          end
        end
      end
    end
  end
end
