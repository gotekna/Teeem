module Api
  module V1
    class ConsolidationController < ApplicationController
      before_action :set_company_group, only: [ :show, :reconcile, :relationships, :reports ]

      # GET /api/v1/consolidation
      # Returns list of company groups with consolidation summary
      def index
        groups = CompanyGroup.active.includes(:companies)

        render json: {
          success: true,
          groups: groups.map do |group|
            latest_report = group.reconciliation_reports.completed.recent.first
            {
              id: group.id,
              name: group.name,
              companies_count: group.corporate_companies.count,
              latest_reconciliation: latest_report ? {
                id: latest_report.id,
                as_of_date: latest_report.as_of_date,
                health_score: latest_report.match_percentage,
                has_discrepancies: latest_report.has_discrepancies?,
                total_discrepancy: latest_report.total_discrepancy,
                completed_at: latest_report.completed_at
              } : nil
            }
          end
        }
      end

      # GET /api/v1/consolidation/:company_group_id
      # Returns detailed consolidation info for a group
      def show
        as_of_date = params[:as_of_date].present? ? Date.parse(params[:as_of_date]) : Date.today
        service = ConsolidationReconciliationService.new(@company_group, as_of_date: as_of_date)

        relationships = service.intercompany_relationships
        matched = relationships.count { |r| r[:matched] }
        total = relationships.count

        render json: {
          success: true,
          group: {
            id: @company_group.id,
            name: @company_group.name,
            companies: @company_group.corporate_companies.map { |c| { id: c.id, name: c.name } }
          },
          summary: {
            as_of_date: as_of_date,
            total_relationships: total,
            matched: matched,
            mismatched: total - matched,
            health_score: total.zero? ? 100 : (matched.to_f / total * 100).round(0)
          },
          relationships: relationships
        }
      end

      # POST /api/v1/consolidation/:company_group_id/reconcile
      # Run reconciliation for a company group
      def reconcile
        as_of_date = params[:as_of_date].present? ? Date.parse(params[:as_of_date]) : Date.today
        service = ConsolidationReconciliationService.new(@company_group, as_of_date: as_of_date)

        result = service.run_reconciliation

        if result[:success]
          render json: {
            success: true,
            report: format_report(result[:report]),
            summary: result[:summary],
            discrepancies: result[:discrepancies]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/consolidation/:company_group_id/relationships
      # Returns intercompany relationships for a group
      def relationships
        as_of_date = params[:as_of_date].present? ? Date.parse(params[:as_of_date]) : Date.today
        service = ConsolidationReconciliationService.new(@company_group, as_of_date: as_of_date)

        render json: {
          success: true,
          relationships: service.intercompany_relationships,
          as_of_date: as_of_date
        }
      end

      # GET /api/v1/consolidation/:company_group_id/reports
      # Returns reconciliation report history for a group
      def reports
        reports = @company_group.reconciliation_reports.recent.limit(20)

        render json: {
          success: true,
          reports: reports.map { |r| format_report(r) }
        }
      end

      # GET /api/v1/consolidation/mismatches
      # Returns all current mismatches across all groups (for health dashboard)
      def mismatches
        as_of_date = params[:as_of_date].present? ? Date.parse(params[:as_of_date]) : Date.today

        all_mismatches = []

        CompanyGroup.active.includes(:companies).each do |group|
          next if group.corporate_companies.count < 2

          service = ConsolidationReconciliationService.new(group, as_of_date: as_of_date)
          relationships = service.intercompany_relationships

          mismatched = relationships.reject { |r| r[:matched] }
          mismatched.each do |m|
            all_mismatches << m.merge(
              group_id: group.id,
              group_name: group.name
            )
          end
        end

        render json: {
          success: true,
          total_mismatches: all_mismatches.count,
          total_discrepancy: all_mismatches.sum { |m| m[:discrepancy].abs },
          mismatches: all_mismatches,
          as_of_date: as_of_date
        }
      end

      # GET /api/v1/consolidation/company/:company_id
      # Returns intercompany summary for a specific company
      def company_summary
        company = Corporate.find_by_slug_or_id(params[:company_id])
        unless company
          return render json: { success: false, error: "Company not found" }, status: :not_found
        end

        unless company.company_group
          return render json: {
            success: false,
            error: "Company is not part of a group"
          }, status: :bad_request
        end

        as_of_date = params[:as_of_date].present? ? Date.parse(params[:as_of_date]) : Date.today
        service = ConsolidationReconciliationService.new(company.company_group, as_of_date: as_of_date)

        render json: {
          success: true,
          summary: service.company_summary(company)
        }
      end

      private

      def set_company_group
        @company_group = CompanyGroup.find(params[:company_group_id] || params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Company group not found" }, status: :not_found
      end

      def format_report(report)
        {
          id: report.id,
          company_group_id: report.company_group_id,
          as_of_date: report.as_of_date,
          status: report.status,
          total_pairs_checked: report.total_pairs_checked,
          matched_pairs: report.matched_pairs,
          mismatched_pairs: report.mismatched_pairs,
          total_discrepancy: report.total_discrepancy,
          health_score: report.match_percentage,
          has_discrepancies: report.has_discrepancies?,
          summary: report.summary,
          discrepancies: report.discrepancies,
          started_at: report.started_at,
          completed_at: report.completed_at,
          duration_seconds: report.duration_seconds
        }
      end
    end
  end
end
