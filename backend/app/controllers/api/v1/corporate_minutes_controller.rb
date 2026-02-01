module Api
  module V1
    class CorporateMinutesController < ApplicationController
      before_action :set_company
      before_action :set_minute, only: [ :show, :update, :destroy, :sign, :generate_pdf ]

      # GET /api/v1/companies/:company_id/minutes
      def index
        @minutes = @company.corporate_minutes
                          .includes(:minute_template)
                          .order(meeting_date: :desc)

        # Filter by status
        if params[:status].present?
          @minutes = @minutes.where(status: params[:status])
        end

        # Filter by year
        if params[:year].present?
          @minutes = @minutes.where("EXTRACT(YEAR FROM meeting_date) = ?", params[:year])
        end

        render json: {
          success: true,
          data: @minutes.map { |m| serialize_minute(m) }
        }
      end

      # GET /api/v1/companies/:company_id/minutes/:id
      def show
        render json: {
          success: true,
          data: serialize_minute(@minute, include_content: true)
        }
      end

      # POST /api/v1/companies/:company_id/minutes
      def create
        @minute = @company.corporate_minutes.new(minute_params)

        # If template provided, generate initial content
        if @minute.minute_template.present? && @minute.content.blank?
          @minute.content = generate_content_from_template(@minute.minute_template)
        end

        if @minute.save
          render json: {
            success: true,
            data: serialize_minute(@minute, include_content: true)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @minute.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:company_id/minutes/:id
      def update
        if @minute.update(minute_params)
          render json: {
            success: true,
            data: serialize_minute(@minute, include_content: true)
          }
        else
          render json: {
            success: false,
            errors: @minute.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:company_id/minutes/:id
      def destroy
        if @minute.status == "signed" || @minute.status == "filed"
          return render json: {
            success: false,
            errors: [ "Cannot delete signed or filed minutes" ]
          }, status: :unprocessable_entity
        end

        @minute.destroy
        render json: { success: true }
      end

      # POST /api/v1/companies/:company_id/minutes/:id/sign
      def sign
        signed_by = params[:signed_by]
        signed_date = params[:signed_date] || Date.current

        if signed_by.blank?
          return render json: {
            success: false,
            errors: [ "Signatory names required" ]
          }, status: :unprocessable_entity
        end

        @minute.update!(
          status: "signed",
          signed_by: signed_by,
          signed_date: signed_date
        )

        render json: {
          success: true,
          data: serialize_minute(@minute, include_content: true)
        }
      end

      # POST /api/v1/companies/:company_id/minutes/:id/generate_from_template
      def generate_from_template
        @minute = @company.corporate_minutes.find(params[:id])
        template = MinuteTemplate.find(params[:template_id])
        variables = params[:variables] || {}

        # Build variables from company data
        company_variables = {
          "company_name" => @company.name,
          "acn" => @company.formatted_acn,
          "abn" => @company.formatted_abn,
          "registered_office" => @company.registered_office_address,
          "principal_place" => @company.principal_place_of_business,
          "meeting_date" => @minute.meeting_date.strftime("%d %B %Y")
        }

        # Add director info
        if @company.current_directors.any?
          company_variables["director_name"] = @company.current_directors.first.display_name
          company_variables["director_names"] = @company.current_directors.map(&:display_name).join(", ")
        end

        # Merge with provided variables
        merged_variables = company_variables.merge(variables.to_h)

        # Generate content
        content = render_template(template.body, merged_variables)

        @minute.update!(
          minute_template: template,
          content: content
        )

        render json: {
          success: true,
          data: serialize_minute(@minute.reload, include_content: true)
        }
      end

      # POST /api/v1/companies/:company_id/minutes/create_from_template
      def create_from_template
        template = MinuteTemplate.find(params[:template_id])
        variables = params[:variables] || {}
        meeting_date = params[:meeting_date] || Date.current

        # Build variables from company data
        company_variables = {
          "company_name" => @company.name,
          "acn" => @company.formatted_acn,
          "abn" => @company.formatted_abn,
          "registered_office" => @company.registered_office_address,
          "principal_place" => @company.principal_place_of_business,
          "meeting_date" => meeting_date.to_date.strftime("%d %B %Y")
        }

        # Add director info
        if @company.current_directors.any?
          company_variables["director_name"] = @company.current_directors.first.display_name
          company_variables["director_names"] = @company.current_directors.map(&:display_name).join(", ")
        end

        # Merge with provided variables
        merged_variables = company_variables.merge(variables.to_h)

        # Generate content
        content = render_template(template.body, merged_variables)

        @minute = @company.corporate_minutes.create!(
          minute_template: template,
          title: params[:title] || template.name,
          meeting_date: meeting_date,
          content: content,
          status: "draft"
        )

        render json: {
          success: true,
          data: serialize_minute(@minute, include_content: true)
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          errors: [ e.message ]
        }, status: :unprocessable_entity
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      end

      def set_minute
        @minute = @company.corporate_minutes.find(params[:id])
      end

      def minute_params
        params.require(:company_minute).permit(
          :minute_template_id,
          :title,
          :meeting_date,
          :content,
          :status,
          :signed_date,
          :signed_by,
          :document_path
        )
      end

      def serialize_minute(minute, include_content: false)
        data = {
          id: minute.id,
          company_id: minute.company_id,
          minute_template_id: minute.minute_template_id,
          template_name: minute.minute_template&.name,
          title: minute.title,
          meeting_date: minute.meeting_date,
          status: minute.status,
          signed_date: minute.signed_date,
          signed_by: minute.signed_by,
          document_path: minute.document_path,
          created_at: minute.created_at,
          updated_at: minute.updated_at
        }

        if include_content
          data[:content] = minute.content
        end

        data
      end

      def generate_content_from_template(template)
        variables = {
          "company_name" => @company.name,
          "acn" => @company.formatted_acn,
          "abn" => @company.formatted_abn,
          "meeting_date" => Date.current.strftime("%d %B %Y")
        }

        render_template(template.body, variables)
      end

      def render_template(body, variables)
        return "" unless body.present?

        result = body.dup
        variables.each do |key, value|
          result.gsub!("{{#{key}}}", value.to_s)
        end
        result
      end
    end
  end
end
