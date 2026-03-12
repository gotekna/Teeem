# frozen_string_literal: true

module Api
  module V1
    class ClaimInvoiceTemplatesController < ApplicationController
      # GET /api/v1/claim_invoice_templates
      # Returns all active templates for selection in Schedule Master UI
      def index
        templates = ClaimInvoiceTemplate.active.order(:name)

        render json: {
          success: true,
          data: templates.map(&:preview_data)
        }
      end

      # GET /api/v1/claim_invoice_templates/:id
      # Returns a single template with full details
      def show
        template = ClaimInvoiceTemplate.find(params[:id])

        render json: {
          success: true,
          data: template.preview_data
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Template not found", status: :not_found)
      end

      # PATCH/PUT /api/v1/claim_invoice_templates/:id
      # Update template settings (colors, fonts, visibility)
      def update
        template = ClaimInvoiceTemplate.find(params[:id])
        template.update!(template_params)

        render json: {
          success: true,
          data: template.preview_data
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Template not found", status: :not_found)
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      end

      # PATCH /api/v1/claim_invoice_templates/:id/set_default
      # Set this template as the default
      def set_default
        ClaimInvoiceTemplate.transaction do
          ClaimInvoiceTemplate.where(is_default: true).update_all(is_default: false)
          template = ClaimInvoiceTemplate.find(params[:id])
          template.update!(is_default: true)
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render_error("Template not found", status: :not_found)
      end

      # GET /api/v1/claim_invoice_templates/:id/preview
      # Returns HTML preview of the template with sample data
      # Accepts optional query params to customize preview:
      #   - trading_name: Company name to show on invoice (overrides company settings)
      #   - claim_percentage: Percentage of contract price
      #   - task_name: Name of the claim task/stage
      #   - contract_price: Contract price (overrides job data)
      #   - job_id: Job ID to fetch real job data from
      def preview
        template = ClaimInvoiceTemplate.find(params[:id])

        # SSoT: Use real company data from TenantSetting
        company_settings = TenantSetting.instance

        # Optionally fetch real job data
        job = params[:job_id].present? ? Job.find_by(id: params[:job_id]) : nil

        # Use provided trading_name, fallback to company name from settings
        trading_name = params[:trading_name].presence || company_settings.company_name || "ABC Construction Pty Ltd"
        claim_percentage = params[:claim_percentage].present? ? params[:claim_percentage].to_f : 15.0
        task_name = params[:task_name].presence || "Slab"

        # Contract price priority: param > job > default
        contract_price = if params[:contract_price].present?
                           params[:contract_price].to_f
                         elsif job&.contract_price.present?
                           job.contract_price.to_f
                         else
                           450_000  # Default for house build
                         end

        # Calculate amounts based on percentage and contract price
        claim_amount = (contract_price * claim_percentage / 100).round(2)
        gst_amount = (claim_amount * 0.1).round(2)
        total_amount = claim_amount + gst_amount

        # Build job/client data from real job or defaults
        job_name = job&.name.presence || "Smith Residence - New Home Build"
        job_address = job&.job_address.presence || job&.name.presence || "45 Example Avenue, Suburb QLD 4000"
        client_name = job&.client&.display_name.presence || job&.client&.name.presence || "John & Jane Smith"
        client_address = job&.client&.address.presence || "Current Address, Brisbane QLD 4000"

        # Sample data for preview using real company data
        sample_data = {
          company_name: trading_name,
          company_abn: company_settings.abn.presence || "12 345 678 901",
          company_address: company_settings.address&.gsub("\n", ", ").presence || "123 Builder Street, Brisbane QLD 4000",
          company_phone: company_settings.phone.presence || "(07) 1234 5678",
          company_email: company_settings.email.presence || "accounts@example.com.au",
          job_name: job_name,
          job_address: job_address,
          client_name: client_name,
          client_address: client_address,
          invoice_number: "INV-#{Date.current.year}-0042",
          invoice_date: Date.current.strftime("%d %B %Y"),
          due_date: (Date.current + 14.days).strftime("%d %B %Y"),
          claim_stage: task_name,
          claim_percentage: claim_percentage,
          contract_price: contract_price,
          claim_amount: claim_amount,
          gst_amount: gst_amount,
          total_amount: total_amount,
          previous_claims: 0,
          balance_remaining: (contract_price - claim_amount).round(2),
          # SSoT: Bank details from TenantSetting
          bank_name: company_settings.bank_name.presence || "Commonwealth Bank",
          bsb: company_settings.bank_bsb.presence || "064-000",
          account_number: company_settings.bank_account_number.presence || "1234 5678",
          account_name: company_settings.bank_account_name.presence || trading_name
        }

        html = render_template_preview(template, sample_data)

        render json: {
          success: true,
          data: {
            template: template.preview_data,
            preview_html: html
          }
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Template not found", status: :not_found)
      end

      private

      def template_params
        params.require(:template).permit(
          :name, :description, :primary_color, :secondary_color,
          :font_family, :logo_position, :header_style, :is_active,
          :show_logo, :show_company_details, :show_bank_details,
          :show_payment_terms, :footer_text
        )
      end

      def render_template_preview(template, data)
        # Render based on style_key
        case template.style_key
        when "classic"
          render_classic_template(template, data)
        when "modern"
          render_modern_template(template, data)
        when "bold"
          render_bold_template(template, data)
        when "minimal"
          render_minimal_template(template, data)
        when "compact"
          render_compact_template(template, data)
        when "construction"
          render_construction_template(template, data)
        when "executive"
          render_executive_template(template, data)
        when "skyline"
          render_skyline_template(template, data)
        when "receipt"
          render_receipt_template(template, data)
        else
          render_classic_template(template, data)
        end
      end

      def render_classic_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: white;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #{template.primary_color}; padding-bottom: 20px;">
              #{logo_html(template, data)}
              <div style="text-align: right;">
                <h1 style="margin: 0; color: #{template.primary_color}; font-size: 28px;">PROGRESS CLAIM</h1>
                <p style="margin: 5px 0 0; color: #{template.secondary_color};">#{data[:invoice_number]}</p>
              </div>
            </div>

            <!-- Company & Client Info -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
              #{company_details_html(template, data) if template.show_company_details}
              <div style="text-align: right;">
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">BILL TO</p>
                <p style="margin: 5px 0; font-weight: bold;">#{data[:client_name]}</p>
                <p style="margin: 0; color: #{template.secondary_color};">#{data[:client_address]}</p>
              </div>
            </div>

            <!-- Job Details -->
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
              <p style="margin: 0; font-weight: bold;">#{data[:job_name]}</p>
              <p style="margin: 5px 0 0; color: #{template.secondary_color};">#{data[:job_address]}</p>
            </div>

            <!-- Dates -->
            <div style="display: flex; gap: 40px; margin-bottom: 30px;">
              <div>
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">INVOICE DATE</p>
                <p style="margin: 5px 0; font-weight: bold;">#{data[:invoice_date]}</p>
              </div>
              <div>
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">DUE DATE</p>
                <p style="margin: 5px 0; font-weight: bold;">#{data[:due_date]}</p>
              </div>
            </div>

            <!-- Claim Details Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr style="background: #{template.primary_color}; color: white;">
                  <th style="padding: 12px; text-align: left;">Description</th>
                  <th style="padding: 12px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px;">
                    <strong>#{data[:claim_stage]} Claim</strong><br>
                    <span style="color: #{template.secondary_color};">#{data[:claim_percentage]}% of contract price ($#{number_with_delimiter(data[:contract_price])})</span>
                  </td>
                  <td style="padding: 12px; text-align: right;">$#{number_with_delimiter(data[:claim_amount])}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px;">GST (10%)</td>
                  <td style="padding: 12px; text-align: right;">$#{number_with_delimiter(data[:gst_amount])}</td>
                </tr>
                <tr style="background: #f8fafc;">
                  <td style="padding: 12px; font-weight: bold; font-size: 18px;">TOTAL DUE</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 18px; color: #{template.primary_color};">$#{number_with_delimiter(data[:total_amount])}</td>
                </tr>
              </tbody>
            </table>

            #{bank_details_html(template, data) if template.show_bank_details}

            <!-- Footer -->
            #{footer_html(template)}
          </div>
        HTML
      end

      def render_modern_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; padding: 60px 40px; background: white;">
            <!-- Centered Logo -->
            <div style="text-align: center; margin-bottom: 50px;">
              #{logo_html(template, data, centered: true)}
            </div>

            <!-- Invoice Title -->
            <div style="text-align: center; margin-bottom: 50px;">
              <h1 style="margin: 0; color: #{template.primary_color}; font-size: 14px; letter-spacing: 3px; text-transform: uppercase;">Progress Claim</h1>
              <p style="margin: 10px 0 0; color: #{template.secondary_color}; font-size: 24px;">#{data[:invoice_number]}</p>
            </div>

            <!-- Two Column Info -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 50px;">
              <div>
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">From</p>
                <p style="margin: 8px 0 0;">#{data[:company_name]}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">To</p>
                <p style="margin: 8px 0 0;">#{data[:client_name]}</p>
              </div>
            </div>

            <!-- Job -->
            <div style="border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 20px 0; margin-bottom: 40px;">
              <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Project</p>
              <p style="margin: 8px 0 0; font-size: 18px;">#{data[:job_name]}</p>
            </div>

            <!-- Amount -->
            <div style="text-align: center; margin-bottom: 50px;">
              <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Amount Due</p>
              <p style="margin: 15px 0 0; font-size: 48px; font-weight: bold; color: #{template.primary_color};">$#{number_with_delimiter(data[:total_amount])}</p>
              <p style="margin: 10px 0 0; color: #{template.secondary_color};">#{data[:claim_stage]} (#{data[:claim_percentage]}%) · Due #{data[:due_date]}</p>
            </div>

            #{bank_details_html(template, data, modern: true) if template.show_bank_details}

            #{footer_html(template, centered: true)}
          </div>
        HTML
      end

      def render_bold_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; background: white;">
            <!-- Bold Header Banner -->
            <div style="background: #{template.primary_color}; color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center;">
              #{logo_html(template, data, inverted: true)}
              <div style="text-align: right;">
                <h1 style="margin: 0; font-size: 32px; font-weight: bold;">PROGRESS CLAIM</h1>
                <p style="margin: 5px 0 0; opacity: 0.8;">#{data[:invoice_number]}</p>
              </div>
            </div>

            <div style="padding: 40px;">
              <!-- Quick Info Bar -->
              <div style="display: flex; background: #f8fafc; border-radius: 8px; margin-bottom: 30px;">
                <div style="flex: 1; padding: 20px; border-right: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">CLIENT</p>
                  <p style="margin: 5px 0 0; font-weight: bold;">#{data[:client_name]}</p>
                </div>
                <div style="flex: 1; padding: 20px; border-right: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">PROJECT</p>
                  <p style="margin: 5px 0 0; font-weight: bold;">#{data[:job_name]}</p>
                </div>
                <div style="flex: 1; padding: 20px;">
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">DUE DATE</p>
                  <p style="margin: 5px 0 0; font-weight: bold;">#{data[:due_date]}</p>
                </div>
              </div>

              <!-- Claim Amount Box -->
              <div style="background: #{template.primary_color}; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0; opacity: 0.8; font-size: 14px;">#{data[:claim_stage]} CLAIM (#{data[:claim_percentage]}%)</p>
                <p style="margin: 10px 0 0; font-size: 42px; font-weight: bold;">$#{number_with_delimiter(data[:total_amount])}</p>
                <p style="margin: 10px 0 0; opacity: 0.8;">Including GST of $#{number_with_delimiter(data[:gst_amount])}</p>
              </div>

              #{bank_details_html(template, data) if template.show_bank_details}

              #{footer_html(template)}
            </div>
          </div>
        HTML
      end

      def render_minimal_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px; background: white;">
            <!-- Simple Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;">
              #{logo_html(template, data)}
              <div style="text-align: right; color: #{template.secondary_color};">
                <p style="margin: 0;">#{data[:invoice_number]}</p>
                <p style="margin: 5px 0 0;">#{data[:invoice_date]}</p>
              </div>
            </div>

            <!-- Essential Info Only -->
            <div style="margin-bottom: 30px;">
              <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">TO</p>
              <p style="margin: 5px 0 0;">#{data[:client_name]}</p>
            </div>

            <div style="margin-bottom: 30px;">
              <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">FOR</p>
              <p style="margin: 5px 0 0;">#{data[:job_name]} · #{data[:claim_stage]} Claim</p>
            </div>

            <!-- Simple Amount -->
            <div style="border-top: 2px solid #{template.primary_color}; padding-top: 20px; margin-bottom: 30px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>#{data[:claim_stage]} (#{data[:claim_percentage]}%)</span>
                <span>$#{number_with_delimiter(data[:claim_amount])}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #{template.secondary_color};">
                <span>GST</span>
                <span>$#{number_with_delimiter(data[:gst_amount])}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                <span>Total</span>
                <span>$#{number_with_delimiter(data[:total_amount])}</span>
              </div>
            </div>

            <!-- Bank Details -->
            #{bank_details_html(template, data, minimal: true) if template.show_bank_details}
          </div>
        HTML
      end

      def render_compact_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; padding: 25px 30px; background: white; font-size: 11px; line-height: 1.3;">
            <!-- Compact Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #{template.primary_color};">
              #{logo_html(template, data)}
              <div style="text-align: right;">
                <span style="font-size: 16px; font-weight: bold; color: #{template.primary_color};">PROGRESS CLAIM</span><br>
                <span style="color: #{template.secondary_color}; font-size: 10px;">#{data[:invoice_number]} · #{data[:invoice_date]}</span>
              </div>
            </div>

            <!-- Two Column Info -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <div style="flex: 1;">
                #{company_details_html(template, data) if template.show_company_details}
              </div>
              <div style="flex: 1; text-align: right;">
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 9px; text-transform: uppercase;">Bill To</p>
                <p style="margin: 2px 0; font-weight: bold; font-size: 11px;">#{data[:client_name]}</p>
                <p style="margin: 0; color: #{template.secondary_color}; font-size: 10px;">#{data[:client_address]}</p>
              </div>
            </div>

            <!-- Job + Dates Row -->
            <div style="display: flex; gap: 15px; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 4px; font-size: 10px;">
              <div style="flex: 2;">
                <span style="color: #{template.secondary_color};">Project:</span>
                <strong>#{data[:job_name]}</strong>
              </div>
              <div>
                <span style="color: #{template.secondary_color};">Due:</span>
                <strong>#{data[:due_date]}</strong>
              </div>
            </div>

            <!-- Compact Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;">
              <thead>
                <tr style="background: #{template.primary_color}; color: white;">
                  <th style="padding: 6px 8px; text-align: left; font-size: 9px;">Description</th>
                  <th style="padding: 6px 8px; text-align: right; font-size: 9px; width: 100px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px;">#{data[:claim_stage]} Claim — #{data[:claim_percentage]}% of $#{number_with_delimiter(data[:contract_price])}</td>
                  <td style="padding: 6px 8px; text-align: right;">$#{number_with_delimiter(data[:claim_amount])}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; color: #{template.secondary_color};">GST (10%)</td>
                  <td style="padding: 6px 8px; text-align: right;">$#{number_with_delimiter(data[:gst_amount])}</td>
                </tr>
                <tr style="background: #f8fafc; font-weight: bold;">
                  <td style="padding: 8px;">TOTAL DUE</td>
                  <td style="padding: 8px; text-align: right; color: #{template.primary_color}; font-size: 14px;">$#{number_with_delimiter(data[:total_amount])}</td>
                </tr>
              </tbody>
            </table>

            <!-- Compact Summary Row -->
            <div style="display: flex; gap: 15px; margin-bottom: 12px; font-size: 10px; color: #{template.secondary_color};">
              <span>Contract: $#{number_with_delimiter(data[:contract_price])}</span>
              <span>·</span>
              <span>Previous: $#{number_with_delimiter(data[:previous_claims])}</span>
              <span>·</span>
              <span>Remaining: $#{number_with_delimiter(data[:balance_remaining])}</span>
            </div>

            #{bank_details_html(template, data, minimal: true) if template.show_bank_details}
            #{footer_html(template)}
          </div>
        HTML
      end

      def render_construction_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; background: white;">
            <!-- Yellow Safety Banner -->
            <div style="background: #f59e0b; padding: 4px 40px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #78350f; font-size: 10px; font-weight: bold; letter-spacing: 2px;">PROGRESS CLAIM</span>
              <span style="color: #78350f; font-size: 10px;">#{data[:invoice_number]}</span>
            </div>

            <!-- Header -->
            <div style="padding: 25px 40px 15px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #{template.primary_color};">
              #{logo_html(template, data)}
              <div style="text-align: right;">
                <p style="margin: 0; font-weight: bold; font-size: 20px; color: #{template.primary_color};">PROGRESS CLAIM</p>
                <p style="margin: 5px 0 0; color: #{template.secondary_color};">#{data[:invoice_number]}</p>
                <p style="margin: 2px 0 0; color: #{template.secondary_color}; font-size: 13px;">Date: #{data[:invoice_date]}</p>
              </div>
            </div>

            <div style="padding: 20px 40px 40px;">
              <!-- Project Hero Section -->
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; color: #92400e; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Project / Site</p>
                <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">#{data[:job_name]}</p>
                <p style="margin: 3px 0 0; color: #{template.secondary_color};">#{data[:job_address]}</p>
              </div>

              <!-- Client & Dates -->
              <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 6px;">
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase;">Client</p>
                  <p style="margin: 5px 0 0; font-weight: bold;">#{data[:client_name]}</p>
                  <p style="margin: 2px 0 0; color: #{template.secondary_color}; font-size: 13px;">#{data[:client_address]}</p>
                </div>
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px;">
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase;">Due Date</p>
                  <p style="margin: 5px 0 0; font-weight: bold; font-size: 16px; color: #dc2626;">#{data[:due_date]}</p>
                </div>
              </div>

              #{company_details_html(template, data) if template.show_company_details}

              <!-- Claim Stage Highlight -->
              <div style="background: #{template.primary_color}; color: white; padding: 20px; border-radius: 6px; margin: 25px 0; text-align: center;">
                <p style="margin: 0; opacity: 0.8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">#{data[:claim_stage]} Stage Claim</p>
                <p style="margin: 8px 0 0; font-size: 36px; font-weight: bold;">$#{number_with_delimiter(data[:total_amount])}</p>
                <p style="margin: 8px 0 0; opacity: 0.8; font-size: 13px;">#{data[:claim_percentage]}% of contract ($#{number_with_delimiter(data[:contract_price])}) · Inc. GST $#{number_with_delimiter(data[:gst_amount])}</p>
              </div>

              <!-- Contract Progress -->
              <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px; font-weight: bold; color: #{template.primary_color}; font-size: 13px;">Contract Progress</p>
                <div style="display: flex; gap: 15px;">
                  <div style="flex: 1; text-align: center; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    <p style="margin: 0; font-size: 11px; color: #{template.secondary_color};">Contract</p>
                    <p style="margin: 3px 0 0; font-weight: bold;">$#{number_with_delimiter(data[:contract_price])}</p>
                  </div>
                  <div style="flex: 1; text-align: center; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    <p style="margin: 0; font-size: 11px; color: #{template.secondary_color};">This Claim</p>
                    <p style="margin: 3px 0 0; font-weight: bold; color: #{template.primary_color};">$#{number_with_delimiter(data[:claim_amount])}</p>
                  </div>
                  <div style="flex: 1; text-align: center; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    <p style="margin: 0; font-size: 11px; color: #{template.secondary_color};">Remaining</p>
                    <p style="margin: 3px 0 0; font-weight: bold;">$#{number_with_delimiter(data[:balance_remaining])}</p>
                  </div>
                </div>
              </div>

              #{bank_details_html(template, data) if template.show_bank_details}
              #{footer_html(template)}
            </div>
          </div>
        HTML
      end

      def render_executive_template(template, data)
        # Xero Standard style — white background, accent top bar, clean professional layout
        company_settings = TenantSetting.instance
        logo_url = company_settings&.logo_url
        logo_block = if template.show_logo && logo_url.present?
          "<img src='#{logo_url}' alt='Logo' style='max-height:56px;max-width:180px;display:block;margin-bottom:8px;' />"
        elsif template.show_logo
          "<div style='width:48px;height:48px;background:#{template.primary_color};border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;'><span style='color:white;font-weight:700;font-size:20px;'>#{data[:company_name][0]}</span></div>"
        else
          ""
        end
        company_block = if template.show_company_details
          "<p style='margin:0;font-size:14px;font-weight:600;color:#111827;'>#{data[:company_name]}</p><p style='margin:3px 0 0;font-size:12px;color:#6b7280;'>ABN #{data[:company_abn]}</p><p style='margin:2px 0 0;font-size:12px;color:#6b7280;'>#{data[:company_phone]}</p>"
        else
          ""
        end
        bank_block = if template.show_bank_details
          "<div style='border-top:1px solid #f3f4f6;padding-top:24px;margin-top:8px;'><p style='margin:0 0 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;'>Payment Details</p><div style='display:flex;gap:48px;'><div><p style='margin:0;font-size:11px;color:#9ca3af;'>Bank</p><p style='margin:4px 0 0;font-size:13px;color:#111827;'>#{data[:bank_name]}</p></div><div><p style='margin:0;font-size:11px;color:#9ca3af;'>BSB</p><p style='margin:4px 0 0;font-size:13px;color:#111827;'>#{data[:bsb]}</p></div><div><p style='margin:0;font-size:11px;color:#9ca3af;'>Account</p><p style='margin:4px 0 0;font-size:13px;color:#111827;'>#{data[:account_number]}</p></div><div><p style='margin:0;font-size:11px;color:#9ca3af;'>Account Name</p><p style='margin:4px 0 0;font-size:13px;color:#111827;'>#{data[:account_name]}</p></div></div></div>"
        else
          ""
        end
        <<~HTML
          <div style="font-family: #{template.font_family}, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; background: white;">
            <!-- Accent top bar -->
            <div style="height:5px;background:#{template.primary_color};"></div>

            <!-- Header: logo/company left | invoice details right -->
            <div style="padding:36px 40px 28px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5e7eb;">
              <div>
                #{logo_block}
                #{company_block}
              </div>
              <div style="text-align:right;">
                <p style="margin:0;font-size:22px;font-weight:700;color:#{template.primary_color};letter-spacing:-0.3px;">Progress Claim</p>
                <p style="margin:6px 0 0;font-size:18px;font-weight:500;color:#111827;">#{data[:invoice_number]}</p>
                <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">Date: #{data[:invoice_date]}</p>
                <p style="margin:3px 0 0;font-size:12px;color:#6b7280;font-weight:500;">Due: #{data[:due_date]}</p>
              </div>
            </div>

            <!-- Bill To / Project — light gray band -->
            <div style="padding:20px 40px;display:flex;gap:60px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <div>
                <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;">Bill To</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">#{data[:client_name]}</p>
                <p style="margin:3px 0 0;font-size:12px;color:#6b7280;">#{data[:client_address]}</p>
              </div>
              <div>
                <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;">Project</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">#{data[:job_name]}</p>
                <p style="margin:3px 0 0;font-size:12px;color:#6b7280;">#{data[:job_address]}</p>
              </div>
            </div>

            <div style="padding:32px 40px;">
              <!-- Line items table -->
              <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
                <thead>
                  <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Description</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:16px 12px;">
                      <p style="margin:0;font-size:14px;font-weight:500;color:#111827;">#{data[:claim_stage]} Stage Claim</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">#{data[:claim_percentage]}% of contract value — $#{number_with_delimiter(data[:contract_price])}</p>
                    </td>
                    <td style="padding:16px 12px;text-align:right;font-size:14px;color:#111827;">$#{number_with_delimiter(data[:claim_amount])}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Totals — right aligned, Xero style -->
              <div style="display:flex;justify-content:flex-end;margin-top:0;border-top:1px solid #f3f4f6;">
                <div style="width:260px;padding-top:16px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;color:#6b7280;">Subtotal</span>
                    <span style="font-size:12px;color:#374151;">$#{number_with_delimiter(data[:claim_amount])}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;">GST (10%)</span>
                    <span style="font-size:12px;color:#374151;">$#{number_with_delimiter(data[:gst_amount])}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid #{template.primary_color};padding-top:12px;">
                    <span style="font-size:15px;font-weight:700;color:#111827;">Total Due</span>
                    <span style="font-size:20px;font-weight:700;color:#{template.primary_color};">$#{number_with_delimiter(data[:total_amount])}</span>
                  </div>
                  <p style="font-size:11px;color:#9ca3af;text-align:right;margin:6px 0 0;">Due #{data[:due_date]}</p>
                </div>
              </div>

              #{bank_block}
              #{footer_html(template)}
            </div>
          </div>
        HTML
      end

      def render_skyline_template(template, data)
        <<~HTML
          <div style="font-family: #{template.font_family}, sans-serif; max-width: 800px; margin: 0 auto; background: white;">
            <!-- Full-width gradient header -->
            <div style="background: linear-gradient(135deg, #{template.primary_color} 0%, #{template.secondary_color} 100%); padding: 50px 40px 60px; position: relative; overflow: hidden;">
              <!-- Decorative circles -->
              <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
              <div style="position:absolute;bottom:-60px;right:80px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>

              <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  #{if template.show_logo
                      company_settings = TenantSetting.instance
                      logo_url = company_settings&.logo_url
                      if logo_url.present?
                        "<img src='#{logo_url}' alt='Logo' style='max-height:50px;max-width:160px;filter:brightness(0) invert(1);margin-bottom:16px;display:block;' />"
                      else
                        "<div style='width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;'><span style='color:white;font-weight:bold;font-size:20px;'>#{data[:company_name][0]}</span></div>"
                      end
                    end}
                  #{"<p style='margin:0;color:white;font-size:18px;font-weight:700;'>#{data[:company_name]}</p><p style='margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;'>ABN #{data[:company_abn]}</p>" if template.show_company_details}
                </div>
                <div style="text-align:right;">
                  <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Progress Claim</p>
                  <p style="margin:8px 0 0;color:white;font-size:28px;font-weight:700;">#{data[:invoice_number]}</p>
                  <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 14px;margin-top:8px;">
                    <p style="margin:0;color:white;font-size:11px;">Due #{data[:due_date]}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- White info strip overlapping header -->
            <div style="background:white;margin:0 40px;border-radius:10px 10px 0 0;margin-top:-24px;box-shadow:0 -4px 20px rgba(0,0,0,0.08);padding:24px 28px;display:flex;gap:0;border:1px solid #f0f0f0;border-bottom:none;">
              <div style="flex:1;border-right:1px solid #f0f0f0;padding-right:24px;">
                <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};">Client</p>
                <p style="margin:6px 0 0;font-size:14px;font-weight:600;">#{data[:client_name]}</p>
              </div>
              <div style="flex:2;padding:0 24px;border-right:1px solid #f0f0f0;">
                <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};">Project</p>
                <p style="margin:6px 0 0;font-size:14px;font-weight:600;">#{data[:job_name]}</p>
                <p style="margin:2px 0 0;font-size:11px;color:#{template.secondary_color};">#{data[:job_address]}</p>
              </div>
              <div style="padding-left:24px;text-align:right;">
                <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};">Issued</p>
                <p style="margin:6px 0 0;font-size:13px;">#{data[:invoice_date]}</p>
              </div>
            </div>

            <div style="margin:0 40px 40px;border:1px solid #f0f0f0;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
              <!-- Claim breakdown -->
              <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
                <thead>
                  <tr style="border-bottom:2px solid #{template.primary_color};">
                    <th style="padding:8px 0;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};">Description</th>
                    <th style="padding:8px 0;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #f5f5f5;">
                    <td style="padding:14px 0;">
                      <p style="margin:0;font-weight:600;">#{data[:claim_stage]} Stage — #{data[:claim_percentage]}% of contract</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#{template.secondary_color};">Contract value: $#{number_with_delimiter(data[:contract_price])}</p>
                    </td>
                    <td style="padding:14px 0;text-align:right;font-weight:500;">$#{number_with_delimiter(data[:claim_amount])}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f5f5f5;">
                    <td style="padding:10px 0;font-size:13px;color:#{template.secondary_color};">GST (10%)</td>
                    <td style="padding:10px 0;text-align:right;font-size:13px;color:#{template.secondary_color};">$#{number_with_delimiter(data[:gst_amount])}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Big total -->
              <div style="background:linear-gradient(135deg,#{template.primary_color},#{template.secondary_color});border-radius:10px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0;color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Total Amount Due</p>
                <p style="margin:12px 0 0;color:white;font-size:40px;font-weight:700;letter-spacing:-1px;">$#{number_with_delimiter(data[:total_amount])}</p>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">Including GST of $#{number_with_delimiter(data[:gst_amount])}</p>
              </div>

              <!-- Progress bar -->
              <div style="margin-bottom:28px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <span style="font-size:11px;color:#{template.secondary_color};">Contract progress</span>
                  <span style="font-size:11px;font-weight:600;">#{data[:claim_percentage]}%</span>
                </div>
                <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:#{data[:claim_percentage]}%;background:linear-gradient(to right,#{template.primary_color},#{template.secondary_color});border-radius:3px;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:4px;">
                  <span style="font-size:10px;color:#{template.secondary_color};">$0</span>
                  <span style="font-size:10px;color:#{template.secondary_color};">$#{number_with_delimiter(data[:contract_price])}</span>
                </div>
              </div>

              #{if template.show_bank_details
                  "<div style='background:#f8fafc;border-radius:8px;padding:16px 20px;'><p style='margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#{template.secondary_color};'>Payment Details</p><div style='display:flex;gap:24px;flex-wrap:wrap;'><span style='font-size:13px;'><strong>#{data[:bank_name]}</strong></span><span style='font-size:13px;color:#{template.secondary_color};'>BSB #{data[:bsb]}</span><span style='font-size:13px;color:#{template.secondary_color};'>Acc #{data[:account_number]}</span><span style='font-size:13px;color:#{template.secondary_color};'>#{data[:account_name]}</span></div></div>"
                end}
              #{footer_html(template)}
            </div>
          </div>
        HTML
      end

      def render_receipt_template(template, data)
        <<~HTML
          <div style="font-family: 'Courier New', Courier, monospace; max-width: 480px; margin: 0 auto; padding: 40px 32px; background: white; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <!-- Receipt header -->
            <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px dashed #d1d5db;">
              #{if template.show_logo
                  company_settings = TenantSetting.instance
                  logo_url = company_settings&.logo_url
                  if logo_url.present?
                    "<img src='#{logo_url}' alt='Logo' style='max-height:50px;max-width:160px;display:block;margin:0 auto 10px;' />"
                  else
                    "<div style='width:56px;height:56px;background:#{template.primary_color};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;'><span style='color:white;font-weight:bold;font-size:22px;'>#{data[:company_name][0]}</span></div>"
                  end
                end}
              <p style="margin:0;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">#{data[:company_name]}</p>
              #{"<p style='margin:4px 0 0;font-size:11px;color:#{template.secondary_color};'>ABN: #{data[:company_abn]}</p><p style='margin:2px 0 0;font-size:11px;color:#{template.secondary_color};'>#{data[:company_phone]} · #{data[:company_email]}</p>" if template.show_company_details}
            </div>

            <!-- Receipt meta -->
            <div style="margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                <span style="color:#{template.secondary_color};">INVOICE</span>
                <span style="font-weight:700;">#{data[:invoice_number]}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                <span style="color:#{template.secondary_color};">DATE</span>
                <span>#{data[:invoice_date]}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span style="color:#{template.secondary_color};">DUE</span>
                <span style="font-weight:700;color:#{template.primary_color};">#{data[:due_date]}</span>
              </div>
            </div>

            <div style="border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;padding:14px 0;margin-bottom:20px;">
              <div style="font-size:12px;margin-bottom:4px;">
                <span style="color:#{template.secondary_color};">BILL TO:</span> #{data[:client_name]}
              </div>
              <div style="font-size:12px;">
                <span style="color:#{template.secondary_color};">PROJECT:</span> #{data[:job_name]}
              </div>
            </div>

            <!-- Line items -->
            <div style="margin-bottom:20px;">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:2px;color:#{template.secondary_color};">ITEMS</p>

              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;">
                <div style="flex:1;padding-right:8px;">
                  <p style="margin:0;font-weight:700;">#{data[:claim_stage]} Stage Claim</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#{template.secondary_color};">#{data[:claim_percentage]}% of $#{number_with_delimiter(data[:contract_price])}</p>
                </div>
                <div style="text-align:right;white-space:nowrap;">$#{number_with_delimiter(data[:claim_amount])}</div>
              </div>

              <div style="border-top:1px dotted #e5e7eb;padding-top:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                  <span style="color:#{template.secondary_color};">Subtotal</span>
                  <span>$#{number_with_delimiter(data[:claim_amount])}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                  <span style="color:#{template.secondary_color};">GST (10%)</span>
                  <span>$#{number_with_delimiter(data[:gst_amount])}</span>
                </div>
              </div>
            </div>

            <!-- Total box -->
            <div style="background:#{template.primary_color};padding:16px;text-align:center;margin-bottom:20px;border-radius:4px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.75);">TOTAL DUE</p>
              <p style="margin:8px 0 0;font-size:32px;font-weight:700;color:white;letter-spacing:-1px;">$#{number_with_delimiter(data[:total_amount])}</p>
            </div>

            #{if template.show_bank_details
                "<div style='border-top:1px dashed #d1d5db;padding-top:16px;margin-bottom:16px;font-size:11px;'><p style='margin:0 0 8px;font-weight:700;letter-spacing:2px;'>PAYMENT</p><div style='display:flex;justify-content:space-between;margin-bottom:4px;'><span style='color:#{template.secondary_color};'>Bank</span><span>#{data[:bank_name]}</span></div><div style='display:flex;justify-content:space-between;margin-bottom:4px;'><span style='color:#{template.secondary_color};'>BSB</span><span>#{data[:bsb]}</span></div><div style='display:flex;justify-content:space-between;margin-bottom:4px;'><span style='color:#{template.secondary_color};'>Account</span><span>#{data[:account_number]}</span></div><div style='display:flex;justify-content:space-between;'><span style='color:#{template.secondary_color};'>Name</span><span>#{data[:account_name]}</span></div></div>"
              end}

            <!-- Receipt footer -->
            <div style="text-align:center;padding-top:20px;border-top:2px dashed #d1d5db;">
              <p style="margin:0;font-size:11px;color:#{template.secondary_color};">* * * THANK YOU * * *</p>
              <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;">#{data[:company_name]} · #{data[:company_email]}</p>
              #{footer_html(template, centered: true)}
            </div>
          </div>
        HTML
      end

      def logo_html(template, data, centered: false, inverted: false)
        return "" unless template.show_logo

        style = centered ? "text-align: center;" : ""

        # SSoT: Use actual company logo from TenantSetting
        company_settings = TenantSetting.instance
        logo_url = company_settings&.logo_url

        if logo_url.present?
          <<~HTML
            <div style="#{style}">
              <img src="#{logo_url}" alt="Company Logo" style="max-height: 60px; max-width: 200px; #{centered ? 'margin: 0 auto; display: block;' : ''}" />
              #{centered ? "<p style='margin: 10px 0 0; font-weight: bold;'>#{data[:company_name]}</p>" : ''}
            </div>
          HTML
        else
          # Fallback to initial if no logo
          <<~HTML
            <div style="#{style}">
              <div style="width: 50px; height: 50px; background: #{inverted ? 'rgba(255,255,255,0.2)' : template.primary_color}; border-radius: 8px; display: flex; align-items: center; justify-content: center; #{centered ? 'margin: 0 auto;' : ''}">
                <span style="color: white; font-weight: bold; font-size: 20px;">#{data[:company_name][0]}</span>
              </div>
              #{centered ? "<p style='margin: 10px 0 0; font-weight: bold;'>#{data[:company_name]}</p>" : ''}
            </div>
          HTML
        end
      end

      def company_details_html(template, data)
        <<~HTML
          <div>
            <p style="margin: 0; font-weight: bold;">#{data[:company_name]}</p>
            <p style="margin: 5px 0 0; color: #{template.secondary_color}; font-size: 14px;">ABN: #{data[:company_abn]}</p>
            <p style="margin: 2px 0 0; color: #{template.secondary_color}; font-size: 14px;">#{data[:company_address]}</p>
            <p style="margin: 2px 0 0; color: #{template.secondary_color}; font-size: 14px;">#{data[:company_phone]} · #{data[:company_email]}</p>
          </div>
        HTML
      end

      def bank_details_html(template, data, modern: false, minimal: false)
        if minimal
          <<~HTML
            <div style="color: #{template.secondary_color}; font-size: 13px;">
              <p style="margin: 0;">Pay to: #{data[:account_name]}</p>
              <p style="margin: 5px 0 0;">BSB: #{data[:bsb]} · Acc: #{data[:account_number]}</p>
            </div>
          HTML
        elsif modern
          <<~HTML
            <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 30px;">
              <p style="margin: 0; color: #{template.secondary_color}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Payment Details</p>
              <p style="margin: 10px 0 0;">#{data[:bank_name]} · BSB #{data[:bsb]} · Account #{data[:account_number]}</p>
            </div>
          HTML
        else
          <<~HTML
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-weight: bold; color: #{template.primary_color};">Payment Details</p>
              <div style="display: flex; gap: 40px; margin-top: 10px;">
                <div>
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">Bank</p>
                  <p style="margin: 3px 0 0;">#{data[:bank_name]}</p>
                </div>
                <div>
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">BSB</p>
                  <p style="margin: 3px 0 0;">#{data[:bsb]}</p>
                </div>
                <div>
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">Account</p>
                  <p style="margin: 3px 0 0;">#{data[:account_number]}</p>
                </div>
                <div>
                  <p style="margin: 0; color: #{template.secondary_color}; font-size: 12px;">Name</p>
                  <p style="margin: 3px 0 0;">#{data[:account_name]}</p>
                </div>
              </div>
            </div>
          HTML
        end
      end

      def footer_html(template, centered: false)
        return "" unless template.footer_text.present?

        style = centered ? "text-align: center;" : ""
        <<~HTML
          <div style="#{style} color: #{template.secondary_color}; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            #{template.footer_text}
          </div>
        HTML
      end

      def number_with_delimiter(number)
        number.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
      end
    end
  end
end
