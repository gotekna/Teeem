# frozen_string_literal: true

module Api
  module V1
    class BankStatementTemplatesController < ApplicationController
      before_action :set_template, only: %i[show update destroy test_pdf]

      # GET /api/v1/bank_statement_templates
      def index
        @templates = BankStatementTemplate.ordered

        render json: {
          success: true,
          data: @templates.map { |t| template_json(t) },
          meta: {
            layout_styles: BankStatementTemplate.layout_styles,
            date_format_options: BankStatementTemplate.date_format_options
          }
        }
      end

      # GET /api/v1/bank_statement_templates/:id
      def show
        render json: {
          success: true,
          data: template_json(@template)
        }
      end

      # POST /api/v1/bank_statement_templates
      def create
        @template = BankStatementTemplate.new(template_params)

        if @template.save
          render json: {
            success: true,
            data: template_json(@template),
            message: "Bank statement template created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            error: @template.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/bank_statement_templates/:id
      def update
        if @template.update(template_params)
          render json: {
            success: true,
            data: template_json(@template),
            message: "Bank statement template updated successfully"
          }
        else
          render json: {
            success: false,
            error: @template.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/bank_statement_templates/:id
      def destroy
        # Prevent deletion of default template
        if @template.bank_code == "default"
          return render json: {
            success: false,
            error: "Cannot delete the default template"
          }, status: :unprocessable_entity
        end

        @template.destroy
        render json: {
          success: true,
          message: "Bank statement template deleted successfully"
        }
      end

      # POST /api/v1/bank_statement_templates/:id/test_pdf
      # Generate a sample PDF using this template
      def test_pdf
        # Create sample transaction data for preview
        sample_transactions = [
          {
            date: Date.current - 5.days,
            description: "Sample Deposit",
            amount: 1500.00,
            running_balance: 1500.00
          },
          {
            date: Date.current - 3.days,
            description: "Sample Payment - Utilities",
            amount: -250.00,
            running_balance: 1250.00
          },
          {
            date: Date.current - 1.day,
            description: "Sample Transfer",
            amount: 500.00,
            running_balance: 1750.00
          }
        ]

        # Generate PDF using the template
        service = BankTransactionReportService.new(
          transactions: sample_transactions,
          account_name: @template.bank_name,
          start_date: Date.current - 7.days,
          end_date: Date.current,
          template: @template
        )

        result = service.generate

        unless result[:success]
          return render json: {
            success: false,
            error: result[:error] || "Failed to generate PDF"
          }, status: :unprocessable_entity
        end

        send_data result[:pdf],
                  filename: "#{@template.bank_code}_sample_statement.pdf",
                  type: "application/pdf",
                  disposition: "inline"
      rescue StandardError => e
        render json: {
          success: false,
          error: "Failed to generate test PDF: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def set_template
        @template = BankStatementTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Bank statement template not found"
        }, status: :not_found
      end

      def template_params
        params.require(:bank_statement_template).permit(
          :bank_code,
          :bank_name,
          :primary_color,
          :secondary_color,
          :text_on_primary,
          :account_type,
          :date_format,
          :layout_style,
          :is_active,
          detection_patterns: []
        )
      end

      def template_json(template)
        {
          id: template.id,
          bank_code: template.bank_code,
          bank_name: template.bank_name,
          primary_color: template.primary_color,
          secondary_color: template.secondary_color,
          text_on_primary: template.text_on_primary,
          account_type: template.account_type,
          date_format: template.date_format,
          date_format_preview: template.date_format_preview,
          detection_patterns: template.detection_patterns || [],
          layout_style: template.layout_style,
          is_active: template.is_active,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end
    end
  end
end
