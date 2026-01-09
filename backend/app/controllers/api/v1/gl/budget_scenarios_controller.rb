# frozen_string_literal: true

module Api
  module V1
    module Gl
      class BudgetScenariosController < ApplicationController
        # GET /api/v1/gl/budget_scenarios
        def index
          scenarios = current_company.gl_budget_scenarios
                                     .includes(:created_by)
                                     .order(fiscal_year: :desc, created_at: :desc)

          # Filter by year
          scenarios = scenarios.for_year(params[:fiscal_year].to_i) if params[:fiscal_year].present?

          # Filter by status
          scenarios = scenarios.where(status: params[:status]) if params[:status].present?

          render json: {
            success: true,
            data: scenarios.map { |s| scenario_json(s) }
          }
        end

        # GET /api/v1/gl/budget_scenarios/:id
        def show
          scenario = find_scenario

          render json: {
            success: true,
            data: scenario_json(scenario, include_summary: true)
          }
        end

        # POST /api/v1/gl/budget_scenarios
        def create
          scenario = current_company.gl_budget_scenarios.build(scenario_params)
          scenario.created_by = current_user

          if scenario.save
            # Optionally create from base scenario
            scenario.apply_from_base! if params[:copy_from_base] == "true"

            render json: {
              success: true,
              data: scenario_json(scenario, include_summary: true),
              message: "Budget scenario created"
            }
          else
            render json: {
              success: false,
              error: scenario.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/budget_scenarios/:id
        def update
          scenario = find_scenario

          if scenario.update(scenario_params)
            render json: {
              success: true,
              data: scenario_json(scenario, include_summary: true),
              message: "Scenario updated"
            }
          else
            render json: {
              success: false,
              error: scenario.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/budget_scenarios/:id
        def destroy
          scenario = find_scenario

          if scenario.is_default?
            return render json: {
              success: false,
              error: "Cannot delete the default scenario"
            }, status: :unprocessable_entity
          end

          # Delete associated budgets
          ::Gl::Budget.where(
            corporate_company_id: scenario.corporate_company_id,
            scenario: scenario.scenario_type
          ).for_financial_year(scenario.fiscal_year).destroy_all

          scenario.destroy

          render json: {
            success: true,
            message: "Scenario deleted"
          }
        end

        # POST /api/v1/gl/budget_scenarios/:id/set_default
        def set_default
          scenario = find_scenario
          scenario.set_as_default!

          render json: {
            success: true,
            data: scenario_json(scenario),
            message: "Set as default scenario"
          }
        end

        # POST /api/v1/gl/budget_scenarios/:id/activate
        def activate
          scenario = find_scenario
          scenario.update!(status: "active")

          render json: {
            success: true,
            data: scenario_json(scenario),
            message: "Scenario activated"
          }
        end

        # POST /api/v1/gl/budget_scenarios/:id/archive
        def archive
          scenario = find_scenario

          if scenario.is_default?
            return render json: {
              success: false,
              error: "Cannot archive the default scenario"
            }, status: :unprocessable_entity
          end

          scenario.update!(status: "archived")

          render json: {
            success: true,
            data: scenario_json(scenario),
            message: "Scenario archived"
          }
        end

        # GET /api/v1/gl/budget_scenarios/compare
        def compare
          scenario1 = find_scenario(params[:scenario1_id])
          scenario2 = find_scenario(params[:scenario2_id])

          comparison = scenario1.compare_with(scenario2)

          render json: {
            success: true,
            data: {
              scenario1: {
                id: scenario1.id,
                name: scenario1.name,
                type: scenario1.scenario_type,
                summary: scenario1.summary
              },
              scenario2: {
                id: scenario2.id,
                name: scenario2.name,
                type: scenario2.scenario_type,
                summary: scenario2.summary
              },
              comparison: comparison
            }
          }
        end

        # GET /api/v1/gl/budget_scenarios/:id/variance
        def variance
          scenario = find_scenario
          budgets = scenario.budgets.includes(:gl_account, :gl_period)

          result = budgets.map do |budget|
            {
              account_code: budget.gl_account.code,
              account_name: budget.gl_account.name,
              period: budget.gl_period.period_name,
              budget: budget.amount,
              actual: budget.actual_amount,
              variance: budget.variance,
              variance_pct: budget.variance_percentage,
              status: budget.status
            }
          end

          render json: {
            success: true,
            data: result
          }
        end

        # GET /api/v1/gl/budget_scenarios/fiscal_years
        def fiscal_years
          years = current_company.gl_budget_scenarios
                                 .distinct
                                 .pluck(:fiscal_year)
                                 .sort
                                 .reverse

          render json: {
            success: true,
            data: years
          }
        end

        private

        def find_scenario(id = nil)
          current_company.gl_budget_scenarios.find(id || params[:id])
        end

        def scenario_params
          params.permit(
            :name, :scenario_type, :fiscal_year, :description,
            :revenue_adjustment_pct, :expense_adjustment_pct, :status,
            assumptions: {}
          )
        end

        def scenario_json(scenario, include_summary: false)
          data = {
            id: scenario.id,
            name: scenario.name,
            scenario_type: scenario.scenario_type,
            fiscal_year: scenario.fiscal_year,
            description: scenario.description,
            assumptions: scenario.assumptions_hash,
            revenue_adjustment_pct: scenario.revenue_adjustment_pct,
            expense_adjustment_pct: scenario.expense_adjustment_pct,
            status: scenario.status,
            is_default: scenario.is_default,
            created_by: scenario.created_by&.name,
            created_at: scenario.created_at
          }

          data[:summary] = scenario.summary if include_summary

          data
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
