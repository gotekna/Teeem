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
        render json: { success: false, error: "Template not found" }, status: :not_found
      end

      # GET /api/v1/claim_invoice_templates/:id/preview
      # Returns HTML preview of the template with sample data
      # Accepts optional query params to customize preview:
      #   - trading_name: Company name to show on invoice
      #   - claim_percentage: Percentage of contract price
      #   - task_name: Name of the claim task/stage
      #   - contract_price: Contract price (default: 45000)
      def preview
        template = ClaimInvoiceTemplate.find(params[:id])

        # Use provided values or defaults
        trading_name = params[:trading_name].presence || "ABC Construction Pty Ltd"
        claim_percentage = params[:claim_percentage].present? ? params[:claim_percentage].to_f : 15.0
        task_name = params[:task_name].presence || "Slab"
        contract_price = params[:contract_price].present? ? params[:contract_price].to_f : 45_000

        # Calculate amounts based on percentage and contract price
        claim_amount = (contract_price * claim_percentage / 100).round(2)
        gst_amount = (claim_amount * 0.1).round(2)
        total_amount = claim_amount + gst_amount

        # Sample data for preview
        sample_data = {
          company_name: trading_name,
          company_abn: "12 345 678 901",
          company_address: "123 Builder Street, Brisbane QLD 4000",
          company_phone: "(07) 1234 5678",
          company_email: "accounts@abcconstruction.com.au",
          job_name: "Smith Residence - New Home Build",
          job_address: "45 Example Avenue, Suburb QLD 4000",
          client_name: "John & Jane Smith",
          client_address: "Current Address, Brisbane QLD 4000",
          invoice_number: "INV-2024-0042",
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
          bank_name: "Commonwealth Bank",
          bsb: "064-000",
          account_number: "1234 5678",
          account_name: trading_name
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
        render json: { success: false, error: "Template not found" }, status: :not_found
      end

      private

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

      def logo_html(template, data, centered: false, inverted: false)
        return "" unless template.show_logo

        style = centered ? "text-align: center;" : ""

        # SSoT: Use actual company logo from CorporateCompanySetting
        company_settings = CorporateCompanySetting.instance
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
