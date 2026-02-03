# frozen_string_literal: true

module Api
  module V1
    module Gl
      class DashboardController < ApplicationController
        # =====================================================
        # MAIN DASHBOARD
        # =====================================================

        # GET /api/v1/gl/dashboard
        # Get full financial dashboard
        def index
          render json: {
            success: true,
            data: dashboard_service.generate
          }
        end

        # GET /api/v1/gl/dashboard/kpis
        # Get key performance indicators only
        def kpis
          render json: {
            success: true,
            data: {
              as_at_date: as_at_date,
              kpis: dashboard_service.key_performance_indicators
            }
          }
        end

        # =====================================================
        # CASH POSITION
        # =====================================================

        # GET /api/v1/gl/dashboard/cash
        # Get cash position summary
        def cash
          render json: {
            success: true,
            data: dashboard_service.cash_position_summary
          }
        end

        # =====================================================
        # REVENUE & EXPENSES
        # =====================================================

        # GET /api/v1/gl/dashboard/revenue_expenses
        # Get revenue and expense summary
        def revenue_expenses
          render json: {
            success: true,
            data: dashboard_service.revenue_expense_summary
          }
        end

        # =====================================================
        # RECEIVABLES & PAYABLES
        # =====================================================

        # GET /api/v1/gl/dashboard/ar_ap
        # Get AR/AP summary
        def ar_ap
          render json: {
            success: true,
            data: dashboard_service.ar_ap_summary
          }
        end

        # =====================================================
        # BANK ACCOUNTS
        # =====================================================

        # GET /api/v1/gl/dashboard/bank_accounts
        # Get bank accounts summary
        def bank_accounts
          render json: {
            success: true,
            data: {
              accounts: dashboard_service.bank_accounts_summary
            }
          }
        end

        # =====================================================
        # ALERTS
        # =====================================================

        # GET /api/v1/gl/dashboard/alerts
        # Get active alerts
        def alerts
          render json: {
            success: true,
            data: {
              alerts: dashboard_service.active_alerts,
              count: dashboard_service.active_alerts.count
            }
          }
        end

        # POST /api/v1/gl/dashboard/alerts/:id/dismiss
        # Dismiss an alert
        def dismiss_alert
          # Would store dismissal in user preferences
          render json: {
            success: true,
            data: { dismissed: params[:id] }
          }
        end

        # =====================================================
        # ACTIVITY
        # =====================================================

        # GET /api/v1/gl/dashboard/activity
        # Get recent activity
        def activity
          render json: {
            success: true,
            data: {
              activity: dashboard_service.recent_activity
            }
          }
        end

        # =====================================================
        # CHARTS
        # =====================================================

        # GET /api/v1/gl/dashboard/charts
        # Get all chart data
        def charts
          render json: {
            success: true,
            data: dashboard_service.chart_data
          }
        end

        # GET /api/v1/gl/dashboard/charts/:chart_type
        # Get specific chart data
        def chart
          chart_type = params[:chart_type].to_sym
          chart_data = dashboard_service.chart_data

          if chart_data.key?(chart_type)
            render json: {
              success: true,
              data: {
                chart_type: chart_type,
                data: chart_data[chart_type]
              }
            }
          else
            render json: {
              success: false,
              error: "Unknown chart type: #{params[:chart_type]}"
            }, status: :not_found
          end
        end

        # =====================================================
        # QUICK ACTIONS
        # =====================================================

        # GET /api/v1/gl/dashboard/quick_actions
        # Get quick action buttons
        def quick_actions
          render json: {
            success: true,
            data: {
              actions: dashboard_service.quick_actions
            }
          }
        end

        # =====================================================
        # WIDGETS
        # =====================================================

        # GET /api/v1/gl/dashboard/widgets
        # Get configurable widget data
        def widgets
          widget_types = params[:types]&.split(',') || default_widget_types

          widgets = widget_types.map do |type|
            {
              type: type,
              data: widget_data(type.to_sym)
            }
          end

          render json: {
            success: true,
            data: { widgets: widgets }
          }
        end

        # POST /api/v1/gl/dashboard/widgets/configure
        # Save widget configuration
        def configure_widgets
          # Would save to user preferences
          render json: {
            success: true,
            data: { configured: params[:widgets] }
          }
        end

        # =====================================================
        # REFRESH
        # =====================================================

        # POST /api/v1/gl/dashboard/refresh
        # Force refresh dashboard data
        def refresh
          # Would clear any caches and regenerate
          render json: {
            success: true,
            data: dashboard_service.generate
          }
        end

        private

        def dashboard_service
          @dashboard_service ||= ::Gl::DashboardService.new(
            current_company,
            as_at_date: as_at_date
          )
        end

        def as_at_date
          @as_at_date ||= params[:as_at_date]&.to_date || Date.current
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user&.corporate_id || 1
          )
        end

        def default_widget_types
          %w[cash_summary revenue_trend receivables_aging alerts]
        end

        def widget_data(type)
          case type
          when :cash_summary
            dashboard_service.cash_position_summary
          when :revenue_trend
            dashboard_service.chart_data[:revenue_vs_expenses]
          when :receivables_aging
            dashboard_service.chart_data[:receivables_aging]
          when :payables_aging
            dashboard_service.chart_data[:payables_aging]
          when :alerts
            dashboard_service.active_alerts
          when :kpis
            dashboard_service.key_performance_indicators
          when :activity
            dashboard_service.recent_activity
          when :bank_accounts
            dashboard_service.bank_accounts_summary
          else
            nil
          end
        end
      end
    end
  end
end
