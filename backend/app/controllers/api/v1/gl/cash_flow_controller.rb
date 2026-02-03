# frozen_string_literal: true

module Api
  module V1
    module Gl
      class CashFlowController < ApplicationController
        # GET /api/v1/gl/cash_flow/forecast
        # Get complete cash flow forecast
        def forecast
          service = build_service

          render json: {
            success: true,
            data: service.forecast
          }
        end

        # GET /api/v1/gl/cash_flow/summary
        # Get quick summary forecast
        def summary
          service = build_service

          render json: {
            success: true,
            data: service.summary_forecast
          }
        end

        # GET /api/v1/gl/cash_flow/inflows
        # Get expected inflows (receivables)
        def inflows
          service = build_service

          render json: {
            success: true,
            data: service.expected_inflows
          }
        end

        # GET /api/v1/gl/cash_flow/outflows
        # Get expected outflows (payables)
        def outflows
          service = build_service

          render json: {
            success: true,
            data: service.expected_outflows
          }
        end

        # GET /api/v1/gl/cash_flow/recurring
        # Get detected recurring patterns
        def recurring
          service = build_service

          render json: {
            success: true,
            data: service.recurring_patterns
          }
        end

        # GET /api/v1/gl/cash_flow/weekly
        # Get weekly aggregated forecast
        def weekly
          service = build_service
          forecast = service.forecast

          render json: {
            success: true,
            data: {
              period: forecast[:period],
              opening_balance: forecast[:opening_balance],
              weekly: forecast[:weekly],
              summary: forecast[:summary],
              warnings: forecast[:warnings]
            }
          }
        end

        # GET /api/v1/gl/cash_flow/daily
        # Get daily forecast
        def daily
          service = build_service
          forecast = service.forecast

          # Paginate daily data
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 30).to_i
          offset = (page - 1) * per_page

          daily_data = forecast[:daily].slice(offset, per_page)

          render json: {
            success: true,
            data: daily_data,
            pagination: {
              page: page,
              per_page: per_page,
              total_days: forecast[:daily].length,
              total_pages: (forecast[:daily].length.to_f / per_page).ceil
            },
            summary: forecast[:summary]
          }
        end

        # GET /api/v1/gl/cash_flow/warnings
        # Get warnings and recommendations
        def warnings
          service = build_service
          forecast = service.forecast

          render json: {
            success: true,
            data: {
              warnings: forecast[:warnings],
              recommendations: forecast[:recommendations]
            }
          }
        end

        # POST /api/v1/gl/cash_flow/scenario
        # Run scenario analysis
        def scenario
          service = build_service

          scenarios = params[:scenarios]&.map do |s|
            {
              name: s[:name],
              type: s[:type],
              description: s[:description],
              params: s[:params]&.to_unsafe_h
            }
          end || []

          if scenarios.empty?
            return render json: {
              success: false,
              error: 'No scenarios provided'
            }, status: :bad_request
          end

          render json: {
            success: true,
            data: service.scenario_analysis(scenarios)
          }
        end

        # GET /api/v1/gl/cash_flow/chart_data
        # Get data formatted for charting
        def chart_data
          service = build_service
          forecast = service.forecast

          # Format for chart display
          chart_data = forecast[:daily].map do |day|
            {
              date: day[:date].strftime('%Y-%m-%d'),
              label: day[:date].strftime('%d %b'),
              balance: day[:closing_balance],
              inflows: day[:inflows][:total],
              outflows: day[:outflows][:total],
              net: day[:net_flow]
            }
          end

          # Also provide weekly for longer periods
          weekly_chart = forecast[:weekly].map do |week|
            {
              date: week[:week_start].strftime('%Y-%m-%d'),
              label: "Week #{week[:week_number]}",
              balance: week[:closing_balance],
              inflows: week[:inflows],
              outflows: week[:outflows],
              net: week[:net_flow],
              lowest: week[:lowest_balance]
            }
          end

          render json: {
            success: true,
            data: {
              daily: chart_data,
              weekly: weekly_chart,
              thresholds: {
                warning: params[:warning_threshold]&.to_i || 10_000,
                critical: params[:critical_threshold]&.to_i || 0
              }
            }
          }
        end

        # GET /api/v1/gl/cash_flow/aging
        # Get AR/AP aging summary
        def aging
          ar_aging = calculate_ar_aging
          ap_aging = calculate_ap_aging

          render json: {
            success: true,
            data: {
              receivables: ar_aging,
              payables: ap_aging,
              net_position: ar_aging[:total] - ap_aging[:total]
            }
          }
        end

        # GET /api/v1/gl/cash_flow/collection_forecast
        # Get expected collection by period
        def collection_forecast
          service = build_service
          inflows = service.expected_inflows

          # Group by expected collection week
          by_week = inflows.group_by { |i| i[:expected_date].beginning_of_week }

          weekly_collections = by_week.map do |week_start, invoices|
            {
              week_start: week_start,
              week_end: week_start + 6.days,
              invoices_count: invoices.length,
              total_due: invoices.sum { |i| i[:amount] },
              expected_collection: invoices.sum { |i| i[:expected_amount] },
              average_probability: (invoices.sum { |i| i[:probability] } / invoices.length * 100).round(0)
            }
          end.sort_by { |w| w[:week_start] }

          render json: {
            success: true,
            data: {
              by_week: weekly_collections,
              totals: {
                total_outstanding: inflows.sum { |i| i[:amount] },
                expected_collection: inflows.sum { |i| i[:expected_amount] }
              }
            }
          }
        end

        # GET /api/v1/gl/cash_flow/payment_schedule
        # Get upcoming payment schedule
        def payment_schedule
          service = build_service
          outflows = service.expected_outflows

          # Group by due week
          by_week = outflows.group_by { |o| o[:due_date].beginning_of_week }

          weekly_payments = by_week.map do |week_start, bills|
            {
              week_start: week_start,
              week_end: week_start + 6.days,
              bills_count: bills.length,
              total_due: bills.sum { |b| b[:amount] },
              critical_count: bills.count { |b| b[:priority] == 'critical' },
              high_priority_total: bills.select { |b| b[:priority].in?(%w[critical high]) }.sum { |b| b[:amount] }
            }
          end.sort_by { |w| w[:week_start] }

          render json: {
            success: true,
            data: {
              by_week: weekly_payments,
              totals: {
                total_outstanding: outflows.sum { |o| o[:amount] },
                overdue: outflows.select { |o| o[:days_until_due].negative? }.sum { |o| o[:amount] }
              }
            }
          }
        end

        private

        def build_service
          ::Gl::CashFlowForecastService.new(
            current_company,
            days: (params[:days] || 90).to_i,
            start_date: params[:start_date].present? ? Date.parse(params[:start_date]) : Date.current,
            warning_threshold: (params[:warning_threshold] || 10_000).to_i,
            critical_threshold: (params[:critical_threshold] || 0).to_i
          )
        end

        def calculate_ar_aging
          receivables = Gl::Invoice
            .where(corporate: current_company)
            .where(invoice_type: 'sales_invoice')
            .where(status: %w[approved submitted])
            .where('amount_due > 0')

          buckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_90_plus: 0
          }

          receivables.each do |invoice|
            days_overdue = invoice.days_overdue

            if days_overdue <= 0
              buckets[:current] += invoice.amount_due
            elsif days_overdue <= 30
              buckets[:days_1_30] += invoice.amount_due
            elsif days_overdue <= 60
              buckets[:days_31_60] += invoice.amount_due
            elsif days_overdue <= 90
              buckets[:days_61_90] += invoice.amount_due
            else
              buckets[:days_90_plus] += invoice.amount_due
            end
          end

          buckets[:total] = buckets.values.sum
          buckets
        end

        def calculate_ap_aging
          payables = Gl::Invoice
            .where(corporate: current_company)
            .where(invoice_type: 'bill')
            .where(status: %w[approved submitted])
            .where('amount_due > 0')

          buckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_90_plus: 0
          }

          payables.each do |bill|
            days_overdue = (Date.current - bill.due_date).to_i

            if days_overdue <= 0
              buckets[:current] += bill.amount_due
            elsif days_overdue <= 30
              buckets[:days_1_30] += bill.amount_due
            elsif days_overdue <= 60
              buckets[:days_31_60] += bill.amount_due
            elsif days_overdue <= 90
              buckets[:days_61_90] += bill.amount_due
            else
              buckets[:days_90_plus] += bill.amount_due
            end
          end

          buckets[:total] = buckets.values.sum
          buckets
        end

        def current_company
          @current_company ||= Corporate.find(params[:corporate_id] || current_user&.corporate_id || 1)
        end
      end
    end
  end
end
