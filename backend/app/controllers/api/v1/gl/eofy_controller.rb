# frozen_string_literal: true

module Api
  module V1
    module Gl
      class EofyController < ApplicationController
        # =====================================================
        # EOFY STATUS & CHECKLIST
        # =====================================================

        # GET /api/v1/gl/eofy/status
        # Get full EOFY status including checklist
        def status
          render json: {
            success: true,
            data: eofy_service.status
          }
        end

        # GET /api/v1/gl/eofy/checklist
        # Get checklist with current status
        def checklist
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              items: eofy_service.checklist,
              progress: eofy_service.status[:progress]
            }
          }
        end

        # POST /api/v1/gl/eofy/checklist/:key
        # Update checklist item
        def update_checklist
          result = eofy_service.update_checklist_item(
            params[:key],
            completed: params[:completed],
            notes: params[:notes]
          )

          if result[:success]
            render json: { success: true, data: result[:item] }
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/eofy/run_checks
        # Run all auto-checks
        def run_checks
          render json: {
            success: true,
            data: {
              results: eofy_service.run_auto_checks,
              checked_at: Time.current
            }
          }
        end

        # =====================================================
        # YEAR CLOSURE
        # =====================================================

        # GET /api/v1/gl/eofy/can_close
        # Check if year can be closed
        def can_close
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              can_close: eofy_service.can_close?,
              is_closed: eofy_service.status[:is_closed],
              blocking_items: blocking_items
            }
          }
        end

        # POST /api/v1/gl/eofy/close
        # Close the financial year
        def close_year
          result = eofy_service.close_year!

          if result[:success]
            render json: { success: true, data: result }
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/eofy/reopen
        # Reopen a closed year (admin only)
        def reopen_year
          unless params[:reason].present?
            return render json: { success: false, error: 'Reason is required to reopen a closed year' }, status: :bad_request
          end

          result = eofy_service.reopen_year!(reason: params[:reason])

          if result[:success]
            render json: { success: true, data: result }
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        end

        # =====================================================
        # ADJUSTMENTS
        # =====================================================

        # GET /api/v1/gl/eofy/adjustments
        # Get required year-end adjustments
        def adjustments
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              adjustments: eofy_service.required_adjustments
            }
          }
        end

        # POST /api/v1/gl/eofy/adjustments
        # Create an adjustment journal
        def create_adjustment
          entry = eofy_service.create_adjustment(
            type: params[:type],
            amount: params[:amount].to_d,
            description: params[:description],
            debit_account_id: params[:debit_account_id],
            credit_account_id: params[:credit_account_id]
          )

          render json: {
            success: true,
            data: {
              journal_entry_id: entry.id,
              entry_number: entry.entry_number,
              amount: entry.total_debits
            }
          }
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # =====================================================
        # REPORT PACKAGE
        # =====================================================

        # GET /api/v1/gl/eofy/package
        # Get complete EOFY report package
        def package
          render json: {
            success: true,
            data: package_service.generate
          }
        end

        # GET /api/v1/gl/eofy/profit_loss
        # Get P&L report
        def profit_loss
          render json: {
            success: true,
            data: package_service.profit_loss
          }
        end

        # GET /api/v1/gl/eofy/balance_sheet
        # Get Balance Sheet
        def balance_sheet
          render json: {
            success: true,
            data: package_service.balance_sheet
          }
        end

        # GET /api/v1/gl/eofy/trial_balance
        # Get Trial Balance
        def trial_balance
          render json: {
            success: true,
            data: package_service.trial_balance
          }
        end

        # GET /api/v1/gl/eofy/gst_summary
        # Get GST Summary for year
        def gst_summary
          render json: {
            success: true,
            data: package_service.gst_summary
          }
        end

        # GET /api/v1/gl/eofy/depreciation
        # Get Depreciation Schedule
        def depreciation
          render json: {
            success: true,
            data: package_service.depreciation
          }
        end

        # GET /api/v1/gl/eofy/payg
        # Get PAYG Summary
        def payg
          render json: {
            success: true,
            data: package_service.payg
          }
        end

        # GET /api/v1/gl/eofy/comparatives
        # Get year-on-year comparatives
        def comparatives
          package = package_service.generate

          render json: {
            success: true,
            data: package[:comparatives]
          }
        end

        # GET /api/v1/gl/eofy/metrics
        # Get key financial metrics
        def metrics
          package = package_service.generate

          render json: {
            success: true,
            data: package[:key_metrics]
          }
        end

        # POST /api/v1/gl/eofy/export
        # Export EOFY package
        def export
          format = params[:format] || 'json'
          package = package_service.export_data

          case format
          when 'json'
            render json: { success: true, data: package }
          when 'pdf'
            # Would generate PDF
            render json: {
              success: true,
              data: {
                format: 'pdf',
                note: 'PDF generation will be implemented',
                cover_page: package[:cover_page]
              }
            }
          else
            render json: { success: true, data: package }
          end
        end

        # =====================================================
        # TAX RETURN
        # =====================================================

        # GET /api/v1/gl/eofy/tax_return
        # Get tax return preparation data
        def tax_return
          render json: {
            success: true,
            data: tax_service.generate
          }
        end

        # GET /api/v1/gl/eofy/tax_summary
        # Get tax summary only
        def tax_summary
          render json: {
            success: true,
            data: tax_service.tax_summary
          }
        end

        # GET /api/v1/gl/eofy/tax_estimate
        # Get tax estimate for planning
        def tax_estimate
          render json: {
            success: true,
            data: tax_service.estimate
          }
        end

        # POST /api/v1/gl/eofy/tax_return/calculate
        # Calculate with custom parameters
        def calculate_tax
          service = ::Gl::TaxReturnService.new(
            current_company,
            financial_year,
            payg_instalments_paid: params[:payg_paid]&.to_d,
            prior_year_losses: params[:prior_losses]&.to_d,
            private_use_adjustment: params[:private_use]&.to_d,
            rd_incentive: params[:rd_incentive]&.to_d,
            franking_opening_balance: params[:franking_balance]&.to_d
          )

          render json: {
            success: true,
            data: service.generate
          }
        end

        # =====================================================
        # FINANCIAL YEARS
        # =====================================================

        # GET /api/v1/gl/eofy/years
        # List available financial years
        def years
          current = current_fy
          years = []

          # Current and last 5 years
          6.times do |i|
            fy_year = current.delete('FY').to_i - i
            fy = "FY#{fy_year}"
            fy_start = Date.new(fy_year - 1, 7, 1)
            fy_end = Date.new(fy_year, 6, 30)

            service = ::Gl::EofyService.new(current_company, fy)
            status = service.status

            years << {
              financial_year: fy,
              label: "#{fy_start.strftime('%d %b %Y')} - #{fy_end.strftime('%d %b %Y')}",
              start_date: fy_start,
              end_date: fy_end,
              status: status[:status],
              is_current: fy == current,
              is_closed: status[:is_closed],
              progress: status[:progress][:percentage]
            }
          end

          render json: {
            success: true,
            data: {
              current_year: current,
              years: years
            }
          }
        end

        # =====================================================
        # DASHBOARD
        # =====================================================

        # GET /api/v1/gl/eofy/dashboard
        # EOFY dashboard summary
        def dashboard
          status = eofy_service.status
          package = package_service.generate

          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              status: status[:status],
              progress: status[:progress],
              next_steps: status[:next_steps],
              key_figures: {
                revenue: package[:reports][:profit_loss][:summary][:total_revenue],
                net_profit: package[:reports][:profit_loss][:summary][:net_profit],
                total_assets: package[:reports][:balance_sheet][:sections][:assets][:total],
                total_liabilities: package[:reports][:balance_sheet][:sections][:liabilities][:total],
                estimated_tax: tax_service.estimate[:estimated_tax]
              },
              checklist_summary: {
                total: status[:progress][:total],
                completed: status[:progress][:completed],
                critical_remaining: status[:progress][:critical_total] - status[:progress][:critical_completed]
              },
              due_dates: tax_service.generate[:due_dates]
            }
          }
        end

        private

        def eofy_service
          @eofy_service ||= ::Gl::EofyService.new(current_company, financial_year)
        end

        def package_service
          @package_service ||= ::Gl::Reports::EofyPackage.new(
            current_company,
            financial_year,
            include_zero_balances: params[:include_zero_balances] == 'true'
          )
        end

        def tax_service
          @tax_service ||= ::Gl::TaxReturnService.new(current_company, financial_year)
        end

        def financial_year
          @financial_year ||= params[:financial_year] || current_fy
        end

        def current_fy
          today = Date.current
          year = today.month >= 7 ? today.year + 1 : today.year
          "FY#{year}"
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user&.corporate_id || 1
          )
        end

        def blocking_items
          eofy_service.checklist.select { |item| item[:critical] && !item[:completed] }.map do |item|
            { key: item[:key], label: item[:label] }
          end
        end
      end
    end
  end
end
