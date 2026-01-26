module Api
  module V1
    class DocumentTasksController < ApplicationController
      include DocumentProviderAware
      include PresignedUploadHandler

      before_action :set_job

      # GET /api/v1/jobs/:job_id/document_tasks
      def index
        category_param = params[:category]

        # Support both category ID (numeric) and category name (string)
        if category_param =~ /^\d+$/
          # Numeric ID - look up from EntityTab first (SSoT), then JobDocumentationTab, then DocumentationCategory
          entity_tab = EntityTab.find_by(id: category_param)
          if entity_tab
            category = entity_tab.tab_key || entity_tab.display_name.downcase.gsub(" ", "-")
          else
            doc_tab = @job.job_documentation_tabs.find_by(id: category_param)
            if doc_tab
              category = doc_tab.name.downcase.gsub(" ", "-")
            else
              doc_category = DocumentationCategory.find_by(id: category_param)
              category = doc_category&.name&.downcase&.gsub(" ", "-") || category_param
            end
          end
        else
          category = category_param
        end

        # Get or create document tasks for this job and category
        tasks = DocumentTask.where(
          job_id: @job.id,
          category: category
        )

        # If no tasks exist, create default tasks for the category
        if tasks.empty?
          tasks = create_default_tasks(category)
        end

        render json: {
          tasks: tasks.map { |task| task_json(task) }
        }
      end

      # POST /api/v1/jobs/:job_id/document_tasks/:id/upload
      # SSoT: Uses PresignedUploadHandler for file uploads (supports both multipart and presigned URL)
      def upload
        task = DocumentTask.find_or_create_by(
          id: params[:id],
          job_id: @job.id,
          category: params[:category]
        )

        # SSoT: Accept either file upload or storage_key from presigned URL
        uploaded_file = resolve_uploaded_file(:file, :storage_key)
        unless uploaded_file
          return render_upload_error
        end

        storage_url = nil

        # Try to upload to storage provider first
        begin
          setup_default_provider!

          # Build job folder path
          job_folder_path = build_job_folder_path(@job)

          # Get the folder path from the documentation tab
          tab = @job.job_documentation_tabs.find_by(id: params[:category])
          folder_path = tab&.folder_path

          if folder_path.present?
            # Build full target path
            target_folder_path = "#{job_folder_path}/#{folder_path}"

            # Ensure folder exists
            get_or_create_folder_path(target_folder_path)

            # Upload the file
            result = upload_to_provider(
              target_folder_path,
              uploaded_file.read,
              uploaded_file.original_filename,
              content_type: uploaded_file.content_type
            )
            storage_url = result[:web_url] || result[:path]
          end
        rescue DocumentProviders::NotConnectedError => e
          Rails.logger.warn "Storage not connected (will continue with local): #{e.message}"
        rescue DocumentProviders::Error => e
          Rails.logger.warn "Storage upload failed (will continue with local): #{e.message}"
        end

        # SSoT: Attach to StorageBlob (Jan 2026 - replaces ActiveStorage)
        task.attach_file(
          uploaded_file.read,
          filename: uploaded_file.original_filename,
          content_type: uploaded_file.content_type
        )
        task.update(
          has_document: true,
          uploaded_at: Time.current,
          uploaded_by: current_user&.email,
          storage_url: storage_url
        )

        render json: {
          message: "Document uploaded successfully",
          document_url: storage_url || task.document_url,
          sharepoint_url: storage_url,
          uploaded_at: task.uploaded_at,
          provider: current_provider_type&.to_s
        }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/jobs/:job_id/document_tasks/:id/validate
      def validate
        task = DocumentTask.find(params[:id])

        unless task.has_document
          return render json: { error: "Cannot validate without a document" }, status: :bad_request
        end

        task.update(
          is_validated: true,
          validated_at: Time.current,
          validated_by: current_user&.email
        )

        render json: {
          message: "Document validated successfully",
          validated_at: task.validated_at,
          validated_by: task.validated_by
        }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      # SSoT: Use StorageConfiguration.job_path for consistent folder naming
      def build_job_folder_path(job)
        storage_config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
      end

      def task_json(task)
        {
          id: task.id,
          name: task.name,
          description: task.description,
          required: task.required,
          category: task.category,
          has_document: task.has_document,
          is_validated: task.is_validated,
          document_url: task.storage_url || task.document_url,
          sharepoint_url: task.storage_url, # Alias for frontend compatibility
          uploaded_at: task.uploaded_at,
          validated_at: task.validated_at,
          validated_by: task.validated_by
        }
      end

      def create_default_tasks(category)
        tasks_data = default_tasks_for_category(category)

        tasks_data.map do |task_data|
          DocumentTask.create!(
            job_id: @job.id,
            category: category,
            name: task_data[:name],
            description: task_data[:description],
            required: task_data[:required],
            has_document: false,
            is_validated: false
          )
        end
      end

      def default_tasks_for_category(category)
        case category
        when "site", "site-plan", "site-docs"
          [
            { name: "Survey Plan", description: "Property survey plan documentation", required: true },
            { name: "Soil Test", description: "Soil test report for foundations", required: true }
          ]
        when "sales"
          [
            { name: "Sales Contract", description: "Signed sales contract", required: true },
            { name: "Payment Schedule", description: "Agreed payment schedule", required: true },
            { name: "Client Information Form", description: "Completed client information", required: true }
          ]
        when "certification", "council"
          [
            { name: "Building Consent", description: "Approved building consent", required: true },
            { name: "Engineering Certificates", description: "Structural engineering certificates", required: true },
            { name: "Plumbing Certificate", description: "Plumbing compliance certificate", required: false },
            { name: "Electrical Certificate", description: "Electrical compliance certificate", required: false }
          ]
        when "client"
          [
            { name: "Client ID Verification", description: "Copy of client ID", required: true },
            { name: "Contact Details", description: "Emergency contact information", required: true },
            { name: "Insurance Documents", description: "Home insurance documents", required: false }
          ]
        when "client-photo", "site-photo", "slab-photo", "frame-photo", "enclosed-photo", "fixing-photo", "pc-photo", "supervisor-photo"
          [
            { name: "Before Photos", description: "Site photos before construction", required: true },
            { name: "Progress Photos", description: "Construction progress photos", required: false },
            { name: "Completion Photos", description: "Final completion photos", required: true }
          ]
        when "final-certificate", "final-approval", "final-docs"
          [
            { name: "Code Compliance Certificate", description: "CCC from council", required: true },
            { name: "Warranty Documents", description: "Builder warranty documents", required: true },
            { name: "As-Built Plans", description: "Final as-built construction plans", required: true },
            { name: "Maintenance Guide", description: "Home maintenance guide", required: false }
          ]
        when "revit-dwg"
          [
            { name: "Architectural Revit Model", description: "Main architectural Revit file", required: true },
            { name: "Structural Drawings", description: "Structural engineering drawings", required: true },
            { name: "DWG Exports", description: "AutoCAD DWG exports", required: false }
          ]
        when "land-info"
          [
            { name: "Title Search", description: "Property title search document", required: true },
            { name: "Survey Plan", description: "Land survey documentation", required: true },
            { name: "Zoning Certificate", description: "Council zoning certificate", required: false }
          ]
        when "estimation"
          [
            { name: "Cost Estimate", description: "Detailed cost estimation", required: true },
            { name: "Quantity Takeoff", description: "Material quantities", required: true },
            { name: "Quote Comparison", description: "Supplier quote comparison", required: false }
          ]
        when "contracts"
          [
            { name: "Building Contract", description: "Signed building contract", required: true },
            { name: "Variations", description: "Contract variations", required: false },
            { name: "Progress Claims", description: "Progress claim documentation", required: false }
          ]
        when "colour-selection"
          [
            { name: "Colour Schedule", description: "Approved colour schedule", required: true },
            { name: "Material Selections", description: "Material selection sheets", required: true }
          ]
        when "plans", "sales-plans", "certified-plans", "working-drawings"
          [
            { name: "Floor Plans", description: "Floor plan drawings", required: true },
            { name: "Elevations", description: "Building elevations", required: true },
            { name: "Sections", description: "Building sections", required: false }
          ]
        when "purchase-order", "accounts"
          [
            { name: "Purchase Orders", description: "Approved purchase orders", required: false },
            { name: "Invoices", description: "Supplier invoices", required: false }
          ]
        when "ndis", "ndis-final"
          [
            { name: "NDIS Approval", description: "NDIS approval documentation", required: true },
            { name: "SDA Assessment", description: "SDA assessment report", required: false }
          ]
        when "plumbing", "plumbing-final"
          [
            { name: "Plumbing Plan", description: "Plumbing layout plan", required: true },
            { name: "Plumbing Certificate", description: "Plumbing compliance certificate", required: true }
          ]
        when "energy-efficiency"
          [
            { name: "Energy Report", description: "Energy efficiency report", required: true },
            { name: "NatHERS Certificate", description: "NatHERS rating certificate", required: true }
          ]
        when "form-21"
          [
            { name: "Form 21", description: "Form 21 - Final Inspection", required: true }
          ]
        else
          []
        end
      end
    end
  end
end
