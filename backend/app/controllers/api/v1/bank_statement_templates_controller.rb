# frozen_string_literal: true

module Api
  module V1
    class BankStatementTemplatesController < ApplicationController
      before_action :set_template, only: %i[show update destroy test_pdf reference_image]

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
        # Try to find a real BankAccount for realistic preview data
        # Look for accounts matching this template's bank_code or with corporate company
        sample_account = find_sample_bank_account

        # Create sample transaction data for preview
        sample_transactions = [
          {
            date: Date.current - 5.days,
            description: "Direct Credit - Wages",
            amount: 5500.00
          },
          {
            date: Date.current - 4.days,
            description: "BPAY - Origin Energy",
            amount: -285.50
          },
          {
            date: Date.current - 3.days,
            description: "Transfer from Savings",
            amount: 1000.00
          },
          {
            date: Date.current - 2.days,
            description: "EFTPOS Purchase - Bunnings",
            amount: -156.80
          },
          {
            date: Date.current - 1.day,
            description: "ATM Withdrawal",
            amount: -200.00
          }
        ]

        # Generate PDF using the template
        account_name = sample_account&.corporate_company&.name || sample_account&.account_name || @template.bank_name

        service = BankTransactionReportService.new(
          bank_account: sample_account,
          transactions: sample_transactions,
          account_name: account_name,
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

      # GET /api/v1/bank_statement_templates/:id/reference_image
      # Serve the reference image - checks local files first, then SharePoint
      def reference_image
        unless @template.reference_image_path.present?
          # Try to find a local reference file by convention
          local_file = find_local_reference_file
          if local_file
            return send_local_reference_file(local_file)
          end

          return render json: {
            success: false,
            error: "No reference image available for this template"
          }, status: :not_found
        end

        # Check if it's a local file path first
        if @template.reference_image_path.start_with?("reference_statements/")
          local_path = Rails.root.join(@template.reference_image_path)
          if File.exist?(local_path)
            return send_local_reference_file(local_path)
          end
        end

        # Try local reference_statements folder by convention (bank_code)
        local_file = find_local_reference_file
        if local_file
          return send_local_reference_file(local_file)
        end

        # Fall back to SharePoint
        serve_sharepoint_reference
      end

      private

      def find_local_reference_file
        find_local_reference_file_for(@template)
      end

      def send_local_reference_file(file_path)
        content_type = case File.extname(file_path).downcase
                       when ".png" then "image/png"
                       when ".jpg", ".jpeg" then "image/jpeg"
                       when ".pdf" then "application/pdf"
                       else "application/octet-stream"
                       end

        send_file file_path,
                  filename: File.basename(file_path),
                  type: content_type,
                  disposition: "inline"
      end

      def serve_sharepoint_reference
        storage_config = StorageConfiguration.instance
        unless storage_config&.connected?
          return render json: {
            success: false,
            error: "SharePoint not configured"
          }, status: :service_unavailable
        end

        begin
          client = MicrosoftAppGraphClient.new
          drive_id = storage_config.drive_id

          item = client.get_item_by_path(drive_id, @template.reference_image_path)

          unless item
            return render json: {
              success: false,
              error: "Reference file not found in SharePoint: #{@template.reference_image_path}"
            }, status: :not_found
          end

          content = client.get_drive_item_content(
            drive_id: drive_id,
            item_id: item[:id]
          )

          content_type = case File.extname(@template.reference_image_path).downcase
                         when ".png" then "image/png"
                         when ".jpg", ".jpeg" then "image/jpeg"
                         when ".pdf" then "application/pdf"
                         else "application/octet-stream"
                         end

          send_data content,
                    filename: File.basename(@template.reference_image_path),
                    type: content_type,
                    disposition: "inline"
        rescue MicrosoftAppGraphClient::NotConnectedError => e
          render json: {
            success: false,
            error: "SharePoint not connected: #{e.message}"
          }, status: :service_unavailable
        rescue MicrosoftAppGraphClient::ApiError => e
          render json: {
            success: false,
            error: "Failed to fetch reference image from SharePoint: #{e.message}"
          }, status: :service_unavailable
        end
      end

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

      # Find a sample BankAccount for realistic preview
      # Prefers accounts with corporate company that has address data
      def find_sample_bank_account
        # First try to find by matching bank_code
        if @template.bank_code.present? && @template.bank_code != "default"
          account = BankAccount.joins(:corporate_company)
                               .where(bank_code: @template.bank_code)
                               .where.not(corporate_companies: { registered_office_address: [ nil, "" ] })
                               .first
          return account if account
        end

        # Fall back to any account with good address data
        BankAccount.joins(:corporate_company)
                   .where.not(corporate_companies: { registered_office_address: [ nil, "" ] })
                   .where.not(bsb: [ nil, "" ])
                   .where.not(account_number: [ nil, "" ])
                   .first
      end

      def template_json(template)
        local_ref = find_local_reference_file_for(template)
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
          reference_image_path: local_ref ? File.basename(local_ref) : template.reference_image_path,
          has_reference_image: local_ref.present? || template.reference_image_path.present?,
          is_active: template.is_active,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end

      def find_local_reference_file_for(template)
        reference_dir = Rails.root.join("reference_statements")
        return nil unless Dir.exist?(reference_dir)

        bank_code = template.bank_code.upcase
        patterns = [
          "#{bank_code}_statement_reference.*",
          "#{bank_code}_business_statement_guide.*",
          "#{bank_code}_*.*"
        ]

        patterns.each do |pattern|
          matches = Dir.glob(reference_dir.join(pattern), File::FNM_CASEFOLD)
          return matches.first if matches.any?
        end

        nil
      end
    end
  end
end
