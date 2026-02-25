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

        # Store one WarehouseDocument per position-specific doc type, all sharing the same blob.
        # This creates individual entries for each resignation/consent per position.
        asic_folder = WarehouseFolder.find_by_type_and_name("corporate", "ASIC")
        current_user = resolve_user
        base_metadata = {
          workflow_instance_id: @instance.id,
          form_type: "form_484",
          generated_at: Time.current.iso8601
        }

        create_warehouse_documents(blob, asic_folder, current_user, base_metadata, ceasing, appointments)

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

      # Position → document type abbreviation mapping (matches ASIC warehouse folder WFDTs)
      RESIGNATION_DOC_TYPES = {
        "director" => "RD",
        "secretary" => "RS",
        "public_officer" => "RPO"
      }.freeze

      CONSENT_DOC_TYPES = {
        "director" => "CAD",
        "secretary" => "CAS",
        "public_officer" => "CAPO"
      }.freeze

      def create_warehouse_documents(blob, asic_folder, current_user, base_metadata, ceasing, appointments)
        # 1. Minutes of Meeting of Directors → DM
        create_one_warehouse_doc(blob, asic_folder, current_user, "DM",
          "Minutes of Meeting of Directors", base_metadata)

        # 2. One resignation per ceasing position
        ceasing.each do |cd|
          name = cd[:corporate_director].contact.display_name
          date_str = cd[:cessation_date].strftime("%d/%m/%Y")
          known_positions = cd[:positions].select { |p| RESIGNATION_DOC_TYPES.key?(p) }
          known_positions.each do |pos|
            abbr = RESIGNATION_DOC_TYPES[pos]
            formatted_pos = pos.tr("_", " ").split.map(&:capitalize).join(" ")
            create_one_warehouse_doc(blob, asic_folder, current_user, abbr,
              "Resignation #{formatted_pos} - #{name} #{date_str}",
              base_metadata.merge(person: name, position: pos, date: cd[:cessation_date].iso8601))
          end
        end

        # 3. One consent per appointment position
        appointments.each do |appt|
          name = appt[:contact].display_name
          date_str = appt[:appointment_date].strftime("%d/%m/%Y")
          known_positions = appt[:positions].select { |p| CONSENT_DOC_TYPES.key?(p) }
          known_positions.each do |pos|
            abbr = CONSENT_DOC_TYPES[pos]
            formatted_pos = pos.tr("_", " ").split.map(&:capitalize).join(" ")
            create_one_warehouse_doc(blob, asic_folder, current_user, abbr,
              "Consent to Act as #{formatted_pos} - #{name} #{date_str}",
              base_metadata.merge(person: name, position: pos, date: appt[:appointment_date].iso8601))
          end
        end

        # 4. Form 484 Record → F484
        create_one_warehouse_doc(blob, asic_folder, current_user, "F484",
          "Form 484 Record", base_metadata)
      end

      def create_one_warehouse_doc(blob, asic_folder, current_user, abbreviation, display_name, metadata)
        wfdt = asic_folder && WarehouseFolderDocumentType
          .joins(:document_type)
          .find_by(warehouse_folder: asic_folder, document_types: { abbreviation: abbreviation })

        doc = WarehouseDocumentCreator.create!(
          filename: display_name,
          source_type: "corporate",
          linkable: @subject,
          storage_blob: blob,
          warehouse_folder_id: asic_folder&.id,
          metadata: metadata,
          user: current_user
        )
        # Override WFDT and ui_name (creator applies primary WFDT's template, not ours)
        updates = { ui_name: display_name }
        updates[:warehouse_folder_document_type_id] = wfdt.id if wfdt
        doc.update_columns(updates)
        doc
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
