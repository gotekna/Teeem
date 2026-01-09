# frozen_string_literal: true

module Api
  module V1
    module Gl
      class BasController < ApplicationController
        # GET /api/v1/gl/bas
        # Get full BAS preparation for a period
        def index
          render json: {
            success: true,
            data: bas_service.generate
          }
        end

        # GET /api/v1/gl/bas/preview
        # Quick preview of BAS amounts
        def preview
          render json: {
            success: true,
            data: bas_service.preview
          }
        end

        # GET /api/v1/gl/bas/gst
        # GST section only
        def gst
          render json: {
            success: true,
            data: bas_service.gst_only
          }
        end

        # GET /api/v1/gl/bas/payg
        # PAYG sections only
        def payg
          render json: {
            success: true,
            data: bas_service.payg_only
          }
        end

        # GET /api/v1/gl/bas/periods
        # List available BAS periods
        def periods
          current_fy = financial_year_for(Date.current)
          prior_fy = "FY#{current_fy.delete('FY').to_i - 1}"

          periods = []

          # Current FY quarters
          [current_fy, prior_fy].each do |fy|
            year = fy.delete('FY').to_i
            base_year = year - 1 # FY2025 starts in July 2024

            # Q1: Jul-Sep
            periods << build_period(Date.new(base_year, 7, 1), 'Q1', fy)
            # Q2: Oct-Dec
            periods << build_period(Date.new(base_year, 10, 1), 'Q2', fy)
            # Q3: Jan-Mar
            periods << build_period(Date.new(year, 1, 1), 'Q3', fy)
            # Q4: Apr-Jun
            periods << build_period(Date.new(year, 4, 1), 'Q4', fy)
          end

          # Filter to only past or current quarters
          today = Date.current
          periods = periods.select { |p| p[:start_date] <= today }

          render json: {
            success: true,
            data: {
              periods: periods.sort_by { |p| p[:start_date] }.reverse,
              current_period: detect_current_period(periods)
            }
          }
        end

        # GET /api/v1/gl/bas/history
        # History of lodged BAS
        def history
          # Would query stored BAS records
          # For now, return structure for when lodgement tracking is added
          render json: {
            success: true,
            data: {
              lodged: [],
              pending: [],
              note: 'BAS lodgement history will be tracked when lodgement recording is implemented'
            }
          }
        end

        # POST /api/v1/gl/bas/validate
        # Validate BAS before lodgement
        def validate
          bas = bas_service.generate

          render json: {
            success: true,
            data: {
              validation: bas[:validation],
              reconciliation: bas[:reconciliation],
              summary: bas[:summary],
              ready_to_lodge: bas[:validation][:valid] && bas[:reconciliation][:overall_status] == 'reconciled'
            }
          }
        end

        # POST /api/v1/gl/bas/export
        # Export BAS data for ATO portal
        def export
          bas = bas_service.generate
          format = params[:format] || 'json'

          case format
          when 'csv'
            csv_data = generate_csv(bas)
            render json: {
              success: true,
              data: {
                format: 'csv',
                content: csv_data,
                filename: "BAS_#{bas[:bas_period][:label].gsub(' ', '_')}.csv"
              }
            }
          when 'pdf'
            # Would generate PDF - for now return structure
            render json: {
              success: true,
              data: {
                format: 'pdf',
                note: 'PDF generation will be added',
                summary: bas[:summary]
              }
            }
          else
            render json: {
              success: true,
              data: bas
            }
          end
        end

        # GET /api/v1/gl/bas/comparison
        # Compare current vs prior period
        def comparison
          current = bas_service.generate
          prior_service = build_prior_service
          prior = prior_service.generate

          render json: {
            success: true,
            data: {
              current_period: current[:bas_period],
              prior_period: prior[:bas_period],
              comparison: {
                gst_on_sales: {
                  current: current[:gst_section][:label_1a_gst_on_sales],
                  prior: prior[:gst_section][:label_1a_gst_on_sales],
                  change: current[:gst_section][:label_1a_gst_on_sales] - prior[:gst_section][:label_1a_gst_on_sales],
                  change_pct: calculate_change_pct(
                    prior[:gst_section][:label_1a_gst_on_sales],
                    current[:gst_section][:label_1a_gst_on_sales]
                  )
                },
                gst_on_purchases: {
                  current: current[:gst_section][:label_1b_gst_on_purchases],
                  prior: prior[:gst_section][:label_1b_gst_on_purchases],
                  change: current[:gst_section][:label_1b_gst_on_purchases] - prior[:gst_section][:label_1b_gst_on_purchases],
                  change_pct: calculate_change_pct(
                    prior[:gst_section][:label_1b_gst_on_purchases],
                    current[:gst_section][:label_1b_gst_on_purchases]
                  )
                },
                net_gst: {
                  current: current[:gst_section][:net_gst],
                  prior: prior[:gst_section][:net_gst],
                  change: current[:gst_section][:net_gst] - prior[:gst_section][:net_gst],
                  change_pct: calculate_change_pct(
                    prior[:gst_section][:net_gst],
                    current[:gst_section][:net_gst]
                  )
                },
                total_payable: {
                  current: current[:summary][:total_payable_to_ato],
                  prior: prior[:summary][:total_payable_to_ato],
                  change: current[:summary][:total_payable_to_ato] - prior[:summary][:total_payable_to_ato]
                }
              }
            }
          }
        end

        # GET /api/v1/gl/bas/gst_reconciliation
        # Detailed GST reconciliation
        def gst_reconciliation
          bas = bas_service.generate

          render json: {
            success: true,
            data: {
              period: bas[:bas_period],
              gst_section: bas[:gst_section],
              reconciliation: bas[:reconciliation][:gst],
              transactions: {
                invoices_count: bas[:gst_section][:by_tax_type][:sales].values.sum { |v| v[:count] rescue 0 },
                bills_count: bas[:gst_section][:by_tax_type][:purchases].values.sum { |v| v[:count] rescue 0 }
              }
            }
          }
        end

        # GET /api/v1/gl/bas/transactions
        # List transactions included in BAS
        def transactions
          invoices = period_invoices
          bills = period_bills

          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 50).to_i

          transaction_type = params[:type] || 'all'

          transactions = case transaction_type
          when 'sales'
            invoices.map { |inv| format_transaction(inv, 'sales') }
          when 'purchases'
            bills.map { |bill| format_transaction(bill, 'purchase') }
          else
            invoices.map { |inv| format_transaction(inv, 'sales') } +
              bills.map { |bill| format_transaction(bill, 'purchase') }
          end

          # Sort by date
          transactions = transactions.sort_by { |t| t[:date] }.reverse

          # Paginate
          total = transactions.length
          transactions = transactions.slice((page - 1) * per_page, per_page) || []

          render json: {
            success: true,
            data: transactions,
            pagination: {
              page: page,
              per_page: per_page,
              total: total,
              total_pages: (total.to_f / per_page).ceil
            },
            summary: {
              total_gst_collected: invoices.sum { |inv| inv.line_items.sum { |li| li.tax_amount || 0 } },
              total_gst_paid: bills.sum { |bill| bill.line_items.sum { |li| li.tax_amount || 0 } }
            }
          }
        end

        # POST /api/v1/gl/bas/mark_lodged
        # Mark BAS as lodged (manual tracking)
        def mark_lodged
          lodgement = ::Gl::BasLodgement.create!(
            corporate_company: current_company,
            period_code: params[:quarter] || current_quarter_code,
            period_year: current_financial_year,
            status: "lodged",
            is_amendment: params[:amendment] == true,
            lodgement_reference: params[:reference],
            lodged_at: Time.current,
            lodged_by: current_user,
            data: bas_service.generate
          )

          render json: {
            success: true,
            data: lodgement_json(lodgement),
            message: "BAS marked as lodged"
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/bas/lodge_to_ato
        # Lodge BAS directly to ATO via SBR
        def lodge_to_ato
          unless Sbr::Client.configured?
            return render json: {
              success: false,
              error: "SBR not configured. Register as DSP at https://softwaredevelopers.ato.gov.au/",
              help: "See TEEEM_DOCS/ATO_SBR_INTEGRATION_GUIDE.md for setup instructions"
            }, status: :service_unavailable
          end

          lodger = Sbr::BasLodger.new(current_company)
          lodgement = lodger.lodge(
            period: params[:quarter] || current_quarter_code,
            year: current_financial_year,
            amendment: params[:amendment] == true
          )

          render json: {
            success: lodgement.lodged?,
            data: lodgement_json(lodgement),
            message: lodgement.lodged? ? "BAS lodged to ATO successfully" : "BAS lodgement failed"
          }
        rescue Sbr::BasLodger::ValidationError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue Sbr::BasLodger::AlreadyLodgedError => e
          render json: { success: false, error: e.message }, status: :conflict
        rescue NotImplementedError => e
          render json: {
            success: false,
            error: e.message,
            help: "See TEEEM_DOCS/ATO_SBR_INTEGRATION_GUIDE.md for setup instructions"
          }, status: :service_unavailable
        end

        # GET /api/v1/gl/bas/lodgements
        # List all BAS lodgements
        def lodgements
          lodgements = ::Gl::BasLodgement
            .where(corporate_company: current_company)
            .includes(:lodged_by)
            .order(period_year: :desc, period_code: :desc)
            .limit(params[:limit] || 20)

          render json: {
            success: true,
            data: {
              lodgements: lodgements.map { |l| lodgement_json(l) },
              count: lodgements.count,
              sbr_configured: Sbr::Client.configured?
            }
          }
        end

        # GET /api/v1/gl/bas/sbr_status
        # Check SBR configuration status
        def sbr_status
          render json: {
            success: true,
            data: {
              sbr_configured: Sbr::Client.configured?,
              sbr_environment: Sbr::Client.configured? ? Sbr::Client.environment : nil,
              company_abn: current_company.abn.present?,
              can_lodge: Sbr::Client.configured? && current_company.abn.present?,
              setup_guide: "TEEEM_DOCS/ATO_SBR_INTEGRATION_GUIDE.md",
              missing_config: missing_sbr_config
            }
          }
        end

        # GET /api/v1/gl/bas/chart_data
        # Data for BAS charts
        def chart_data
          # Get last 4 quarters for trend
          quarters = []
          4.times do |i|
            start_date = period_start - (i * 3).months
            end_date = start_date.end_of_quarter

            service = ::Gl::BasPreparationService.new(
              current_company,
              period_start: start_date,
              period_end: end_date
            )

            preview = service.preview
            quarters << {
              period: "#{service.send(:current_quarter)} #{service.send(:financial_year)}",
              period_start: start_date,
              gst_collected: preview[:amounts][:gst_on_sales],
              gst_paid: preview[:amounts][:gst_on_purchases],
              net_gst: preview[:amounts][:net_gst],
              invoices: preview[:invoice_count],
              bills: preview[:bill_count]
            }
          end

          render json: {
            success: true,
            data: {
              quarterly_trend: quarters.reverse,
              labels: quarters.reverse.map { |q| q[:period] },
              datasets: [
                {
                  label: 'GST Collected',
                  data: quarters.reverse.map { |q| q[:gst_collected] },
                  backgroundColor: '#3B82F6'
                },
                {
                  label: 'GST Paid',
                  data: quarters.reverse.map { |q| q[:gst_paid] },
                  backgroundColor: '#10B981'
                },
                {
                  label: 'Net GST',
                  data: quarters.reverse.map { |q| q[:net_gst] },
                  backgroundColor: '#F59E0B'
                }
              ]
            }
          }
        end

        private

        def bas_service
          @bas_service ||= ::Gl::BasPreparationService.new(
            current_company,
            period_start: period_start,
            period_end: period_end,
            payg_rate: params[:payg_rate]&.to_f,
            payg_method: params[:payg_method],
            gst_basis: params[:gst_basis] || 'accrual'
          )
        end

        def period_start
          @period_start ||= if params[:period_start].present?
            Date.parse(params[:period_start])
          elsif params[:quarter].present? && params[:financial_year].present?
            quarter_to_date(params[:quarter], params[:financial_year])
          else
            default_quarter_start
          end
        end

        def period_end
          @period_end ||= if params[:period_end].present?
            Date.parse(params[:period_end])
          else
            period_start.end_of_quarter
          end
        end

        def quarter_to_date(quarter, fy)
          year = fy.delete('FY').to_i
          base_year = year - 1

          case quarter.upcase
          when 'Q1' then Date.new(base_year, 7, 1)
          when 'Q2' then Date.new(base_year, 10, 1)
          when 'Q3' then Date.new(year, 1, 1)
          when 'Q4' then Date.new(year, 4, 1)
          else default_quarter_start
          end
        end

        def default_quarter_start
          today = Date.current
          month = today.month
          year = today.year

          case month
          when 7..9 then Date.new(year, 7, 1)
          when 10..12 then Date.new(year, 10, 1)
          when 1..3 then Date.new(year, 1, 1)
          else Date.new(year, 4, 1)
          end
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user&.corporate_company_id || 1
          )
        end

        def build_prior_service
          prior_start = period_start - 3.months
          prior_end = prior_start.end_of_quarter

          ::Gl::BasPreparationService.new(
            current_company,
            period_start: prior_start,
            period_end: prior_end
          )
        end

        def period_invoices
          ::Gl::Invoice
            .where(corporate_company: current_company)
            .where(invoice_type: 'sales_invoice')
            .where(status: %w[approved paid])
            .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
            .includes(:line_items, :contact)
        end

        def period_bills
          ::Gl::Invoice
            .where(corporate_company: current_company)
            .where(invoice_type: 'bill')
            .where(status: %w[approved paid])
            .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
            .includes(:line_items, :contact)
        end

        def format_transaction(doc, type)
          gst = doc.line_items.sum { |li| li.tax_amount || 0 }

          {
            id: doc.id,
            type: type,
            number: doc.invoice_number,
            date: doc.invoice_date,
            contact: doc.contact&.name,
            total: doc.total,
            gst: gst,
            net: doc.total - gst,
            status: doc.status
          }
        end

        def financial_year_for(date)
          year = date.month >= 7 ? date.year + 1 : date.year
          "FY#{year}"
        end

        def build_period(start_date, quarter, fy)
          end_date = start_date.end_of_quarter
          {
            quarter: quarter,
            financial_year: fy,
            label: "#{quarter} #{fy}",
            start_date: start_date,
            end_date: end_date,
            due_date: end_date + 1.month + 28.days
          }
        end

        def detect_current_period(periods)
          today = Date.current
          periods.find { |p| p[:start_date] <= today && p[:end_date] >= today }
        end

        def calculate_change_pct(prior, current)
          return 0 if prior.zero?

          ((current - prior) / prior.abs * 100).round(1)
        end

        def generate_csv(bas)
          CSV.generate do |csv|
            csv << ['BAS Preparation', bas[:bas_period][:label]]
            csv << []
            csv << ['GST Section']
            csv << ['Label', 'Description', 'Amount']
            csv << ['G1', 'Total Sales (incl GST)', bas[:gst_section][:g1_total_sales]]
            csv << ['G9', 'GST on Sales', bas[:gst_section][:g9_gst_on_sales]]
            csv << ['G12', 'Total Purchases', bas[:gst_section][:g12_total_purchases]]
            csv << ['G20', 'GST on Purchases', bas[:gst_section][:g20_gst_on_purchases]]
            csv << ['1A', 'GST on Sales', bas[:gst_section][:label_1a_gst_on_sales]]
            csv << ['1B', 'GST on Purchases', bas[:gst_section][:label_1b_gst_on_purchases]]
            csv << ['Net', 'Net GST Payable', bas[:gst_section][:net_gst]]
            csv << []
            csv << ['Summary']
            csv << ['Total Payable to ATO', bas[:summary][:total_payable_to_ato]]
            csv << ['Due Date', bas[:summary][:due_date]]
          end
        end

        def period_params
          {
            period_start: period_start,
            period_end: period_end,
            quarter: params[:quarter],
            financial_year: params[:financial_year]
          }
        end

        def current_quarter_code
          case Date.current.month
          when 7, 8, 9 then "Q1"
          when 10, 11, 12 then "Q2"
          when 1, 2, 3 then "Q3"
          when 4, 5, 6 then "Q4"
          end
        end

        def current_financial_year
          # Australian FY: July 1 - June 30
          today = Date.current
          today.month >= 7 ? today.year : today.year - 1
        end

        def lodgement_json(lodgement)
          {
            id: lodgement.id,
            period: lodgement.period_display,
            period_code: lodgement.period_code,
            period_year: lodgement.period_year,
            status: lodgement.status,
            is_amendment: lodgement.is_amendment,
            lodgement_reference: lodgement.lodgement_reference,
            lodged_at: lodgement.lodged_at,
            lodged_by: lodgement.lodged_by&.name,
            net_amount: lodgement.net_amount,
            gst_payable: lodgement.gst_payable,
            can_amend: lodgement.can_amend?,
            created_at: lodgement.created_at
          }
        end

        def missing_sbr_config
          %w[SBR_ENVIRONMENT SBR_DSP_ID SBR_SOFTWARE_ID SBR_CERT_PATH SBR_CERT_PASSWORD]
            .reject { |key| ENV[key].present? }
        end
      end
    end
  end
end
