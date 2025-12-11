module Bpmn
  module Tasks
    class GenerateDocumentTask < BaseTask
      def execute
        template_id = @config["template_id"]
        output_filename = get_config("output_filename", interpolate_value: true)

        raise "No template_id specified" if template_id.blank?

        log_info("Generating document from template ##{template_id}")

        template = DocumentTemplate.find_by(id: template_id)
        raise "Template not found: #{template_id}" unless template

        # Build data context from subject and variables
        data_context = build_data_context

        # Generate the document
        generated_doc = DocumentGenerator.generate(
          template: template,
          data: data_context,
          filename: output_filename
        )

        # Optionally attach to subject
        if @config["attach_to_subject"] && @subject.respond_to?(:documents)
          @subject.documents.attach(generated_doc)
        end

        # Store document reference in variables
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            filename: output_filename,
            template_id: template_id,
            generated_at: Time.current.iso8601
          })
        end

        {
          template_id: template_id,
          filename: output_filename,
          generated_at: Time.current.iso8601
        }
      end

      private

      def build_data_context
        context = {}

        # Add subject fields
        if @subject
          context["subject"] = @subject.attributes
          context[@subject.class.name.underscore] = @subject.attributes
        end

        # Add variables
        context.merge!(@variables)

        # Add any explicit data mappings from config
        if @config["data_mappings"]
          @config["data_mappings"].each do |target_key, source_path|
            context[target_key] = resolve_nested_value(source_path)
          end
        end

        context
      end

      def resolve_nested_value(path)
        parts = path.split(".")
        current = nil

        parts.each_with_index do |part, index|
          current = if index.zero?
                      case part
                      when "subject" then @subject
                      when "variables" then @variables
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
    end
  end
end
