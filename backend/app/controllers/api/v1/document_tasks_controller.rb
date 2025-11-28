module Api
  module V1
    class DocumentTasksController < ApplicationController
      before_action :set_job

      # GET /api/v1/jobs/:job_id/document_tasks
      def index
        category_param = params[:category]

        # Support both category ID (numeric) and category name (string)
        if category_param =~ /^\d+$/
          # Numeric ID - look up the category name from documentation_categories
          doc_category = DocumentationCategory.find_by(id: category_param)
          category = doc_category&.name&.downcase&.gsub(' ', '-') || category_param
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
      def upload
        task = DocumentTask.find_or_create_by(
          id: params[:id],
          job_id: @job.id,
          category: params[:category]
        )

        unless params[:file].present?
          return render json: { error: 'No file provided' }, status: :bad_request
        end

        # Attach the file using ActiveStorage
        task.document.attach(params[:file])
        task.update(
          has_document: true,
          uploaded_at: Time.current,
          uploaded_by: current_user&.email
        )

        render json: {
          message: 'Document uploaded successfully',
          document_url: url_for(task.document),
          uploaded_at: task.uploaded_at
        }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/jobs/:job_id/document_tasks/:id/validate
      def validate
        task = DocumentTask.find(params[:id])

        unless task.has_document
          return render json: { error: 'Cannot validate without a document' }, status: :bad_request
        end

        task.update(
          is_validated: true,
          validated_at: Time.current,
          validated_by: current_user&.email
        )

        render json: {
          message: 'Document validated successfully',
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

      def task_json(task)
        {
          id: task.id,
          name: task.name,
          description: task.description,
          required: task.required,
          category: task.category,
          has_document: task.has_document,
          is_validated: task.is_validated,
          document_url: task.document.attached? ? url_for(task.document) : nil,
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
        when 'site', 'site-plan'
          [
            { name: 'Survey Plan', description: 'Property survey plan documentation', required: true },
            { name: 'Soil Test', description: 'Soil test report for foundations', required: true }
          ]
        when 'sales'
          [
            { name: 'Sales Contract', description: 'Signed sales contract', required: true },
            { name: 'Payment Schedule', description: 'Agreed payment schedule', required: true },
            { name: 'Client Information Form', description: 'Completed client information', required: true }
          ]
        when 'certification'
          [
            { name: 'Building Consent', description: 'Approved building consent', required: true },
            { name: 'Engineering Certificates', description: 'Structural engineering certificates', required: true },
            { name: 'Plumbing Certificate', description: 'Plumbing compliance certificate', required: false },
            { name: 'Electrical Certificate', description: 'Electrical compliance certificate', required: false }
          ]
        when 'client'
          [
            { name: 'Client ID Verification', description: 'Copy of client ID', required: true },
            { name: 'Contact Details', description: 'Emergency contact information', required: true },
            { name: 'Insurance Documents', description: 'Home insurance documents', required: false }
          ]
        when 'client-photo'
          [
            { name: 'Before Photos', description: 'Site photos before construction', required: true },
            { name: 'Progress Photos', description: 'Construction progress photos', required: false },
            { name: 'Completion Photos', description: 'Final completion photos', required: true }
          ]
        when 'final-certificate'
          [
            { name: 'Code Compliance Certificate', description: 'CCC from council', required: true },
            { name: 'Warranty Documents', description: 'Builder warranty documents', required: true },
            { name: 'As-Built Plans', description: 'Final as-built construction plans', required: true },
            { name: 'Maintenance Guide', description: 'Home maintenance guide', required: false }
          ]
        else
          []
        end
      end
    end
  end
end
