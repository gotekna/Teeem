# frozen_string_literal: true

module Bpmn
  module Tasks
    # DirectorChangeTask - Generate ASIC director change package and store in warehouse
    #
    # Reads form_data from the preceding user task (director selections, dates, positions)
    # and delegates to DirectorChangeService to generate the 4-document PDF package.
    # Stores the combined PDF via WarehouseDocumentCreator in the "ASIC" folder.
    #
    # Process variables set:
    #   director_change_blob_id - StorageBlob ID of the combined PDF
    #   director_change_form    - The form_data from the user task (for later steps)
    #   director_change_filename - Generated filename
    #
    class DirectorChangeTask < BaseTask
      def execute
        raise "Subject must be a Corporate" unless @subject.is_a?(Corporate)

        form_data = get_form_data_from_previous_task
        raise "No director change form data found" if form_data.blank?

        log_info("Generating director change package for #{@subject.name}")

        # Resolve directors from form data
        ceasing = resolve_ceasing_directors(form_data["ceasing_directors"] || [])
        appointments = resolve_new_appointments(form_data["new_appointments"] || [])

        # Delegate to existing DirectorChangeService
        service = DirectorChangeService.new(
          company: @subject,
          ceasing_directors: ceasing,
          new_appointments: appointments,
          user: resolve_user
        )

        package = service.generate_package

        # Upload combined PDF to storage
        blob = StorageBlob.find_or_create_for_content!(
          package[:pdf_content],
          filename: package[:filename],
          content_type: "application/pdf"
        )

        # Store in warehouse via ASIC folder
        asic_folder = WarehouseFolder.find_by_type_and_name("corporate", "ASIC")

        WarehouseDocumentCreator.create!(
          filename: package[:filename],
          source_type: "corporate",
          linkable: @subject,
          storage_blob: blob,
          warehouse_folder_id: asic_folder&.id,
          metadata: {
            workflow_instance_id: @instance.id,
            form_type: "form_484",
            ceasing_directors: ceasing.map { |cd| cd[:corporate_director].contact.display_name },
            new_appointments: appointments.map { |a| a[:contact].display_name },
            generated_at: Time.current.iso8601
          },
          user: resolve_user
        )

        # Set process variables for subsequent tasks
        set_variable("director_change_blob_id", blob.id)
        set_variable("director_change_form", form_data)
        set_variable("director_change_filename", package[:filename])

        log_info("Director change package generated: #{package[:filename]} (blob: #{blob.id})")

        {
          success: true,
          blob_id: blob.id,
          filename: package[:filename],
          documents: package[:documents]
        }
      end

      private

      # Find the user task's form_data from completed task instances in this workflow
      def get_form_data_from_previous_task
        completed_user_tasks = BpmnTaskInstance
          .joins(:bpmn_token)
          .where(bpmn_tokens: { bpmn_process_instance_id: @instance.id })
          .where(task_type: "user_task", status: "completed")
          .where.not(form_data: nil)
          .order(completed_at: :desc)

        completed_user_tasks.each do |task|
          return task.form_data if task.form_data.present?
        end

        nil
      end

      # Convert form_data ceasing_directors to service-expected format
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

      # Convert form_data new_appointments to service-expected format
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
        # Try to find the user who started the workflow
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
