# frozen_string_literal: true

module Api
  module V1
    module Gl
      class PersonalTaxController < ApplicationController
        # =====================================================
        # PERSONAL TAX RETURN
        # =====================================================

        # GET /api/v1/gl/personal_tax
        # Get complete personal tax return
        def show
          render json: {
            success: true,
            data: tax_service.generate
          }
        end

        # GET /api/v1/gl/personal_tax/summary
        # Get tax summary only
        def summary
          render json: {
            success: true,
            data: tax_service.tax_summary
          }
        end

        # GET /api/v1/gl/personal_tax/estimate
        # Get tax estimate for planning
        def estimate
          render json: {
            success: true,
            data: tax_service.estimate
          }
        end

        # =====================================================
        # INCOME ITEMS
        # =====================================================

        # GET /api/v1/gl/personal_tax/income
        # Get all income items
        def income
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              items: tax_service.income_items,
              total: tax_service.total_income
            }
          }
        end

        # GET /api/v1/gl/personal_tax/income/:item
        # Get specific income item details
        def income_item
          item_key = params[:item].to_sym
          items = tax_service.income_items

          if items.key?(item_key)
            render json: {
              success: true,
              data: {
                item: item_key,
                details: items[item_key]
              }
            }
          else
            render json: {
              success: false,
              error: "Unknown income item: #{params[:item]}"
            }, status: :not_found
          end
        end

        # =====================================================
        # DEDUCTION ITEMS
        # =====================================================

        # GET /api/v1/gl/personal_tax/deductions
        # Get all deduction items
        def deductions
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              items: tax_service.deduction_items,
              total: tax_service.total_deductions
            }
          }
        end

        # GET /api/v1/gl/personal_tax/deductions/:item
        # Get specific deduction item details
        def deduction_item
          item_key = params[:item].to_sym
          items = tax_service.deduction_items

          if items.key?(item_key)
            render json: {
              success: true,
              data: {
                item: item_key,
                details: items[item_key]
              }
            }
          else
            render json: {
              success: false,
              error: "Unknown deduction item: #{params[:item]}"
            }, status: :not_found
          end
        end

        # =====================================================
        # SCHEDULES
        # =====================================================

        # GET /api/v1/gl/personal_tax/rental
        # Get rental property schedule
        def rental
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              schedule: tax_service.rental_schedule
            }
          }
        end

        # GET /api/v1/gl/personal_tax/business
        # Get sole trader business schedule
        def business
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              schedule: tax_service.business_schedule
            }
          }
        end

        # GET /api/v1/gl/personal_tax/capital_gains
        # Get capital gains schedule
        def capital_gains
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              schedule: tax_service.capital_gains_schedule
            }
          }
        end

        # =====================================================
        # WORK-RELATED EXPENSES
        # =====================================================

        # GET /api/v1/gl/personal_tax/car_expenses
        # Get car expense calculation options
        def car_expenses
          cents_per_km = tax_service.calculate_car_expenses(
            method: 'cents_per_km',
            work_kms: params[:work_kms]&.to_i || 5000
          )

          logbook = if params[:total_expenses].present? && params[:business_percent].present?
                      tax_service.calculate_car_expenses(
                        method: 'logbook',
                        total_expenses: params[:total_expenses].to_d,
                        business_percent: params[:business_percent].to_d
                      )
                    end

          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              methods: {
                cents_per_km: {
                  rate: 0.85,
                  max_kms: 5000,
                  max_deduction: 4250,
                  calculated: cents_per_km
                },
                logbook: {
                  description: 'Actual expenses x business use percentage',
                  requires: ['12-week logbook', 'All expense receipts'],
                  calculated: logbook
                }
              },
              recommendation: cents_per_km >= (logbook || 0) ? 'cents_per_km' : 'logbook'
            }
          }
        end

        # GET /api/v1/gl/personal_tax/home_office
        # Get home office expense calculation options
        def home_office
          fixed_rate = tax_service.calculate_home_office(
            method: 'fixed_rate',
            hours: params[:hours]&.to_i || 0
          )

          actual = if params[:expenses].present?
                     tax_service.calculate_home_office(
                       method: 'actual',
                       expenses: JSON.parse(params[:expenses])
                     )
                   end

          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              methods: {
                fixed_rate: {
                  rate_per_hour: 0.67,
                  description: '67 cents per hour worked from home',
                  includes: ['Electricity', 'Internet', 'Phone', 'Stationery', 'Computer consumables'],
                  excludes: ['Office furniture depreciation', 'Occupancy costs (rent, mortgage interest)'],
                  calculated: fixed_rate
                },
                actual: {
                  description: 'Calculate actual running expenses',
                  requires: ['Detailed records', 'Expense receipts', 'Diary of hours worked'],
                  calculated: actual
                }
              },
              recommendation: fixed_rate >= (actual || 0) ? 'fixed_rate' : 'actual'
            }
          }
        end

        # =====================================================
        # TAX CALCULATION
        # =====================================================

        # POST /api/v1/gl/personal_tax/calculate
        # Calculate tax with custom parameters
        def calculate
          service = ::Gl::PersonalTaxService.new(
            current_user,
            financial_year,
            entity_type: params[:entity_type] || 'individual',
            residency: params[:residency] || 'resident',
            has_private_health: params[:has_private_health] == 'true',
            spouse_income: params[:spouse_income]&.to_d,
            dependents: params[:dependents]&.to_i || 0
          )

          # Add custom income items if provided
          if params[:income].present?
            income = JSON.parse(params[:income])
            income.each do |item, amount|
              service.add_income(item.to_sym, amount.to_d)
            end
          end

          # Add custom deduction items if provided
          if params[:deductions].present?
            deductions = JSON.parse(params[:deductions])
            deductions.each do |item, amount|
              service.add_deduction(item.to_sym, amount.to_d)
            end
          end

          render json: {
            success: true,
            data: service.generate
          }
        rescue JSON::ParserError => e
          render json: {
            success: false,
            error: "Invalid JSON format: #{e.message}"
          }, status: :bad_request
        end

        # =====================================================
        # TIPS & GUIDANCE
        # =====================================================

        # GET /api/v1/gl/personal_tax/tips
        # Get tax tips and recommendations
        def tips
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              tips: tax_service.tax_tips,
              common_deductions: common_deductions_guide,
              due_dates: due_dates
            }
          }
        end

        # GET /api/v1/gl/personal_tax/due_dates
        # Get tax lodgement due dates
        def due_dates
          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              dates: due_dates
            }
          }
        end

        # =====================================================
        # EXPORT
        # =====================================================

        # POST /api/v1/gl/personal_tax/export
        # Export personal tax return data
        def export
          format = params[:format] || 'json'
          data = tax_service.export_data

          case format
          when 'json'
            render json: { success: true, data: data }
          when 'mytax'
            render json: {
              success: true,
              data: {
                format: 'mytax',
                note: 'Use these values to complete your return at my.gov.au',
                sections: data[:sections],
                summary: data[:summary]
              }
            }
          when 'pdf'
            render json: {
              success: true,
              data: {
                format: 'pdf',
                note: 'PDF generation will be implemented',
                summary: data[:summary]
              }
            }
          else
            render json: { success: true, data: data }
          end
        end

        private

        def tax_service
          @tax_service ||= ::Gl::PersonalTaxService.new(
            current_user,
            financial_year,
            entity_type: params[:entity_type] || 'individual',
            residency: params[:residency] || 'resident',
            has_private_health: params[:has_private_health] == 'true'
          )
        end

        def financial_year
          @financial_year ||= params[:financial_year] || current_fy
        end

        def current_fy
          today = Date.current
          year = today.month >= 7 ? today.year + 1 : today.year
          "FY#{year}"
        end

        def current_user
          # In a real implementation, this would come from authentication
          # For now, we'll create a mock user context
          @current_user ||= OpenStruct.new(
            id: params[:user_id] || 1,
            name: params[:user_name] || 'Test User',
            company_id: params[:corporate_id] || 1
          )
        end

        def common_deductions_guide
          {
            work_related: {
              car: {
                description: 'Travel between work locations (not home to work)',
                methods: ['Cents per km (85c/km, max 5000km)', 'Logbook method'],
                tip: 'Cents per km is simpler unless you have high expenses'
              },
              clothing: {
                description: 'Occupation-specific or protective clothing, laundry',
                limits: ['$150 laundry without receipts', 'Must be required for work'],
                tip: 'Everyday clothing is not deductible even if worn to work'
              },
              home_office: {
                description: 'Expenses for working from home',
                methods: ['Fixed rate (67c/hr)', 'Actual cost method'],
                tip: 'Fixed rate covers most expenses, simpler record keeping'
              },
              self_education: {
                description: 'Courses that maintain or improve current employment skills',
                includes: ['Course fees', 'Books', 'Travel to classes'],
                excludes: ['Courses for a new career', 'General interest courses']
              }
            },
            other: {
              donations: {
                description: 'Gifts to deductible gift recipients (DGR)',
                minimum: 2,
                tip: 'Keep receipts, donations under $2 not deductible'
              },
              tax_agent_fees: {
                description: 'Cost of managing your tax affairs',
                includes: ['Tax agent fees', 'Tax software', 'Travel to tax agent']
              },
              income_protection: {
                description: 'Income protection insurance premiums',
                note: 'Only if paid outside of super'
              }
            }
          }
        end

        def due_dates
          fy_year = financial_year.delete('FY').to_i

          {
            fy_end: Date.new(fy_year, 6, 30),
            self_lodge: {
              date: Date.new(fy_year, 10, 31),
              description: 'Lodge by 31 October if lodging yourself'
            },
            tax_agent_registration: {
              date: Date.new(fy_year, 10, 31),
              description: 'Register with tax agent by 31 October for extended deadline'
            },
            tax_agent_lodge: {
              date: Date.new(fy_year + 1, 5, 15),
              description: 'Tax agent lodgement deadline (if registered by 31 Oct)'
            },
            payment: {
              description: '21 days after notice of assessment issued',
              tip: 'Set aside money for tax bill before lodging'
            }
          }
        end
      end
    end
  end
end
