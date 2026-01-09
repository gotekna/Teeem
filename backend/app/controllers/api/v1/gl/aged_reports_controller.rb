# frozen_string_literal: true

module Api
  module V1
    module Gl
      class AgedReportsController < ApplicationController
        # =====================================================
        # AGED RECEIVABLES ENDPOINTS
        # =====================================================

        # GET /api/v1/gl/aged_reports/receivables
        # Full aged receivables report
        def receivables
          report = ar_report_service.generate

          render json: {
            success: true,
            data: report
          }
        end

        # GET /api/v1/gl/aged_reports/receivables/summary
        # Quick summary only
        def receivables_summary
          render json: {
            success: true,
            data: ar_report_service.summary
          }
        end

        # GET /api/v1/gl/aged_reports/receivables/aging
        # Aging buckets breakdown
        def receivables_aging
          render json: {
            success: true,
            data: ar_report_service.aging_summary
          }
        end

        # GET /api/v1/gl/aged_reports/receivables/by_customer
        # Customer breakdown
        def receivables_by_customer
          render json: {
            success: true,
            data: ar_report_service.by_customer
          }
        end

        # GET /api/v1/gl/aged_reports/receivables/customer/:contact_id
        # Single customer detail
        def receivables_for_customer
          result = ar_report_service.for_customer(params[:contact_id])

          if result
            render json: { success: true, data: result }
          else
            render json: { success: false, error: 'Customer not found' }, status: :not_found
          end
        end

        # GET /api/v1/gl/aged_reports/receivables/follow_up
        # Invoices requiring follow-up
        def receivables_follow_up
          render json: {
            success: true,
            data: ar_report_service.follow_up_required
          }
        end

        # =====================================================
        # AGED PAYABLES ENDPOINTS
        # =====================================================

        # GET /api/v1/gl/aged_reports/payables
        # Full aged payables report
        def payables
          report = ap_report_service.generate

          render json: {
            success: true,
            data: report
          }
        end

        # GET /api/v1/gl/aged_reports/payables/summary
        # Quick summary only
        def payables_summary
          render json: {
            success: true,
            data: ap_report_service.summary
          }
        end

        # GET /api/v1/gl/aged_reports/payables/aging
        # Aging buckets breakdown
        def payables_aging
          render json: {
            success: true,
            data: ap_report_service.aging_summary
          }
        end

        # GET /api/v1/gl/aged_reports/payables/by_supplier
        # Supplier breakdown
        def payables_by_supplier
          render json: {
            success: true,
            data: ap_report_service.by_supplier
          }
        end

        # GET /api/v1/gl/aged_reports/payables/supplier/:contact_id
        # Single supplier detail
        def payables_for_supplier
          result = ap_report_service.for_supplier(params[:contact_id])

          if result
            render json: { success: true, data: result }
          else
            render json: { success: false, error: 'Supplier not found' }, status: :not_found
          end
        end

        # GET /api/v1/gl/aged_reports/payables/due_within/:days
        # Bills due within X days
        def payables_due_within
          days = params[:days].to_i
          days = 7 if days <= 0

          render json: {
            success: true,
            data: ap_report_service.due_within(days)
          }
        end

        # GET /api/v1/gl/aged_reports/payables/payment_schedule
        # Optimal payment schedule
        def payables_payment_schedule
          available_cash = params[:available_cash]&.to_d

          render json: {
            success: true,
            data: ap_report_service.payment_schedule(available_cash: available_cash)
          }
        end

        # =====================================================
        # COMBINED REPORTS
        # =====================================================

        # GET /api/v1/gl/aged_reports/dashboard
        # Combined AR/AP dashboard summary
        def dashboard
          ar_summary = ar_report_service.summary
          ap_summary = ap_report_service.summary

          render json: {
            success: true,
            data: {
              as_at_date: as_at_date,
              receivables: ar_summary,
              payables: ap_summary,
              net_position: {
                total: ar_summary[:total_outstanding] - ap_summary[:total_outstanding],
                overdue: ar_summary[:total_overdue] - ap_summary[:total_overdue]
              },
              ratios: {
                dso: ar_summary[:dso],
                dpo: ap_summary[:dpo],
                cash_conversion_cycle: ar_summary[:dso].to_i - ap_summary[:dpo].to_i
              }
            }
          }
        end

        # GET /api/v1/gl/aged_reports/comparison
        # Side-by-side AR vs AP aging
        def comparison
          ar_aging = ar_report_service.aging_summary
          ap_aging = ap_report_service.aging_summary

          buckets = %i[current days_1_30 days_31_60 days_61_90 days_91_120 days_120_plus]

          comparison = buckets.map do |bucket|
            {
              bucket: bucket,
              label: ar_aging[bucket]&.dig(:label) || bucket.to_s.titleize,
              receivables: ar_aging[bucket]&.dig(:amount) || 0,
              payables: ap_aging[bucket]&.dig(:amount) || 0,
              net: (ar_aging[bucket]&.dig(:amount) || 0) - (ap_aging[bucket]&.dig(:amount) || 0)
            }
          end

          render json: {
            success: true,
            data: {
              as_at_date: as_at_date,
              comparison: comparison,
              totals: {
                receivables: ar_aging[:total]&.dig(:amount) || 0,
                payables: ap_aging[:total]&.dig(:amount) || 0,
                net: (ar_aging[:total]&.dig(:amount) || 0) - (ap_aging[:total]&.dig(:amount) || 0)
              }
            }
          }
        end

        # GET /api/v1/gl/aged_reports/critical
        # Critical items requiring attention
        def critical
          ar_report = ar_report_service.generate
          ap_report = ap_report_service.generate

          render json: {
            success: true,
            data: {
              as_at_date: as_at_date,
              high_risk_customers: ar_report[:high_risk_customers],
              critical_suppliers: ap_report[:critical_suppliers],
              follow_up_actions: ar_report[:follow_up_actions],
              overdue_summary: {
                receivables_overdue: ar_report[:summary][:total_overdue],
                receivables_overdue_count: ar_report[:summary][:overdue_count],
                payables_overdue: ap_report[:summary][:total_overdue],
                payables_overdue_count: ap_report[:summary][:overdue_count]
              }
            }
          }
        end

        # GET /api/v1/gl/aged_reports/chart_data
        # Data formatted for charts
        def chart_data
          ar_aging = ar_report_service.aging_summary
          ap_aging = ap_report_service.aging_summary

          buckets = %i[current days_1_30 days_31_60 days_61_90 days_91_120 days_120_plus]
          labels = ['Current', '1-30', '31-60', '61-90', '91-120', '120+']

          render json: {
            success: true,
            data: {
              labels: labels,
              datasets: [
                {
                  label: 'Receivables',
                  data: buckets.map { |b| ar_aging[b]&.dig(:amount) || 0 },
                  backgroundColor: '#3B82F6' # blue
                },
                {
                  label: 'Payables',
                  data: buckets.map { |b| ap_aging[b]&.dig(:amount) || 0 },
                  backgroundColor: '#EF4444' # red
                }
              ]
            }
          }
        end

        private

        def ar_report_service
          @ar_report_service ||= ::Gl::Reports::AgedReceivables.new(
            current_company,
            as_at_date: as_at_date,
            include_invoices: params[:include_invoices] == 'true'
          )
        end

        def ap_report_service
          @ap_report_service ||= ::Gl::Reports::AgedPayables.new(
            current_company,
            as_at_date: as_at_date,
            include_bills: params[:include_bills] == 'true'
          )
        end

        def as_at_date
          @as_at_date ||= params[:as_at_date].present? ? Date.parse(params[:as_at_date]) : Date.current
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user&.corporate_company_id || 1
          )
        end
      end
    end
  end
end
