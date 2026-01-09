# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ConsolidationController < ApplicationController
        # =====================================================
        # MAIN CONSOLIDATION
        # =====================================================

        # GET /api/v1/gl/consolidation
        # Get full consolidated report package
        def index
          render json: {
            success: true,
            data: consolidation_service.generate
          }
        end

        # GET /api/v1/gl/consolidation/entities
        # Get entity structure summary
        def entities
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              entities: consolidation_service.entity_summary
            }
          }
        end

        # =====================================================
        # CONSOLIDATED REPORTS
        # =====================================================

        # GET /api/v1/gl/consolidation/profit_loss
        # Get consolidated P&L
        def profit_loss
          render json: {
            success: true,
            data: consolidation_service.consolidated_profit_loss
          }
        end

        # GET /api/v1/gl/consolidation/balance_sheet
        # Get consolidated Balance Sheet
        def balance_sheet
          render json: {
            success: true,
            data: consolidation_service.consolidated_balance_sheet
          }
        end

        # GET /api/v1/gl/consolidation/trial_balance
        # Get consolidated Trial Balance
        def trial_balance
          render json: {
            success: true,
            data: consolidation_service.consolidated_trial_balance
          }
        end

        # =====================================================
        # ELIMINATIONS
        # =====================================================

        # GET /api/v1/gl/consolidation/eliminations
        # Get elimination entries
        def eliminations
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              entries: consolidation_service.elimination_entries
            }
          }
        end

        # GET /api/v1/gl/consolidation/intercompany
        # Get intercompany summary
        def intercompany
          render json: {
            success: true,
            data: consolidation_service.intercompany_summary
          }
        end

        # =====================================================
        # ENTITY COMPARISON
        # =====================================================

        # GET /api/v1/gl/consolidation/comparison
        # Get entity comparison analysis
        def comparison
          render json: {
            success: true,
            data: consolidation_service.entity_comparison
          }
        end

        # GET /api/v1/gl/consolidation/contribution
        # Get entity contribution analysis
        def contribution
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              analysis: consolidation_service.entity_contribution_analysis
            }
          }
        end

        # =====================================================
        # ADJUSTMENTS
        # =====================================================

        # GET /api/v1/gl/consolidation/adjustments
        # Get consolidation adjustments
        def adjustments
          render json: {
            success: true,
            data: consolidation_service.consolidation_adjustments
          }
        end

        # =====================================================
        # EXPORT
        # =====================================================

        # POST /api/v1/gl/consolidation/export
        # Export consolidated reports
        def export
          format = params[:format] || 'json'
          data = consolidation_service.generate

          case format
          when 'json'
            render json: { success: true, data: data }
          when 'pdf'
            render json: {
              success: true,
              data: {
                format: 'pdf',
                note: 'PDF generation will be implemented',
                summary: {
                  entities: data[:entities].count,
                  revenue: data[:consolidated_profit_loss][:summary][:total_revenue],
                  net_profit: data[:consolidated_profit_loss][:summary][:profit_attributable_to_group],
                  total_assets: data[:consolidated_balance_sheet][:summary][:total_assets]
                }
              }
            }
          else
            render json: { success: true, data: data }
          end
        end

        private

        def consolidation_service
          @consolidation_service ||= ::Gl::ConsolidationService.new(
            parent_company,
            financial_year,
            subsidiaries: subsidiary_companies,
            as_at_date: as_at_date
          )
        end

        def parent_company
          @parent_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user&.corporate_company_id || 1
          )
        end

        def subsidiary_companies
          # Would look up from company relationships
          # For now, return companies in same group if specified
          if params[:subsidiary_ids].present?
            CorporateCompany.where(id: params[:subsidiary_ids].split(','))
          else
            []
          end
        end

        def financial_year
          @financial_year ||= params[:financial_year] || current_fy
        end

        def as_at_date
          @as_at_date ||= params[:as_at_date]&.to_date || Date.current
        end

        def current_fy
          today = Date.current
          year = today.month >= 7 ? today.year + 1 : today.year
          "FY#{year}"
        end
      end
    end
  end
end
