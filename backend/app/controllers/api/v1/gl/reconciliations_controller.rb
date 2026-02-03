# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ReconciliationsController < ApplicationController
        before_action :set_reconciliation, only: %i[
          show update destroy
          load_transactions run_auto_match
          match_lines unmatch_line exclude_line include_line
          create_adjustment complete reopen
          suggestions ai_suggestions accept_ai_suggestion ai_stats
        ]

        # GET /api/v1/gl/reconciliations
        def index
          reconciliations = current_company.gl_bank_reconciliations
            .includes(:gl_account, :completed_by)
            .order(statement_date: :desc)

          # Filter by account
          if params[:account_id].present?
            reconciliations = reconciliations.where(gl_account_id: params[:account_id])
          end

          # Filter by status
          if params[:status].present?
            reconciliations = reconciliations.where(status: params[:status])
          end

          # Filter by provider
          if params[:provider].present?
            reconciliations = reconciliations.where(external_provider: params[:provider])
          end

          render json: {
            success: true,
            data: reconciliations.map { |r| reconciliation_json(r) }
          }
        end

        # GET /api/v1/gl/reconciliations/:id
        def show
          render json: {
            success: true,
            data: reconciliation_json(@reconciliation, include_lines: true)
          }
        end

        # POST /api/v1/gl/reconciliations
        # Start a new reconciliation for a bank account
        def create
          account = current_company.gl_accounts.find(params[:account_id])

          unless account.is_bank_account?
            return render json: {
              success: false,
              error: 'Account must be a bank account'
            }, status: :unprocessable_entity
          end

          reconciliation = ::Gl::BankReconciliation.start_for_account(
            account,
            statement_date: params[:statement_date],
            statement_closing_balance: params[:statement_closing_balance],
            statement_opening_balance: params[:statement_opening_balance]
          )

          render json: {
            success: true,
            data: reconciliation_json(reconciliation)
          }, status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # PATCH/PUT /api/v1/gl/reconciliations/:id
        def update
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot edit a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          if @reconciliation.update(reconciliation_params)
            render json: {
              success: true,
              data: reconciliation_json(@reconciliation)
            }
          else
            render json: {
              success: false,
              error: @reconciliation.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/reconciliations/:id
        def destroy
          if @reconciliation.locked?
            return render json: {
              success: false,
              error: 'Cannot delete a locked reconciliation'
            }, status: :unprocessable_entity
          end

          @reconciliation.destroy!

          render json: { success: true }
        end

        # POST /api/v1/gl/reconciliations/:id/load_transactions
        # Load GL transactions and/or import statement transactions
        def load_transactions
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          # Load GL transactions
          if params[:load_gl] != false
            @reconciliation.load_gl_transactions
          end

          # Import statement transactions if provided
          if params[:statement_transactions].present?
            @reconciliation.import_statement_transactions(
              params[:statement_transactions].map(&:to_unsafe_h)
            )
          end

          @reconciliation.reload

          render json: {
            success: true,
            data: reconciliation_json(@reconciliation, include_lines: true),
            message: "Loaded #{@reconciliation.lines.count} transactions"
          }
        end

        # POST /api/v1/gl/reconciliations/:id/auto_match
        # Run auto-matching on unmatched items
        def run_auto_match
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          enable_ai = params[:enable_ai] != false
          matcher = ::Gl::ReconciliationMatcher.new(@reconciliation, enable_ai: enable_ai)
          matches_found = matcher.auto_match_all

          @reconciliation.reload

          render json: {
            success: true,
            data: reconciliation_json(@reconciliation, include_lines: true),
            matches_found: matches_found,
            ai_suggestions: matcher.ai_suggestions,
            message: "Auto-matched #{matches_found} transaction pairs" +
              (matcher.ai_suggestions.any? ? " (#{matcher.ai_suggestions.count} AI suggestions)" : "")
          }
        end

        # POST /api/v1/gl/reconciliations/:id/match
        # Manually match two lines
        def match_lines
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line1 = @reconciliation.lines.find(params[:line1_id])
          line2 = @reconciliation.lines.find(params[:line2_id])

          if line1.match_with!(line2, match_type: 'manual', confidence: 100)
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Lines matched successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot match these lines'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/unmatch
        # Unmatch a line
        def unmatch_line
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line = @reconciliation.lines.find(params[:line_id])

          if line.unmatch!
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Line unmatched successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot unmatch this line'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/exclude
        # Exclude a line from reconciliation
        def exclude_line
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line = @reconciliation.lines.find(params[:line_id])

          if line.exclude!(params[:reason])
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Line excluded successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot exclude this line'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/include
        # Include a previously excluded line
        def include_line
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line = @reconciliation.lines.find(params[:line_id])

          if line.include!
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Line included successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot include this line'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/adjustment
        # Create an adjustment for an unmatched item
        def create_adjustment
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line = @reconciliation.lines.find(params[:line_id])
          account = current_company.gl_accounts.find(params[:account_id])

          adjustment = line.create_adjustment!(
            account: account,
            reason: params[:reason]
          )

          if adjustment
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              adjustment: line_json(adjustment),
              message: 'Adjustment created successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot create adjustment for this line'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/complete
        # Complete the reconciliation
        def complete
          unless @reconciliation.can_complete?
            return render json: {
              success: false,
              error: @reconciliation.reconciled? ?
                'Cannot complete - reconciliation is locked' :
                "Cannot complete - difference is #{@reconciliation.difference}"
            }, status: :unprocessable_entity
          end

          if @reconciliation.complete!(current_user)
            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Reconciliation completed successfully'
            }
          else
            render json: {
              success: false,
              error: 'Failed to complete reconciliation'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/reconciliations/:id/reopen
        # Reopen a completed reconciliation
        def reopen
          if @reconciliation.reopen!
            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              message: 'Reconciliation reopened successfully'
            }
          else
            render json: {
              success: false,
              error: 'Cannot reopen a locked reconciliation'
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/reconciliations/:id/ai_suggestions
        # Get AI categorization suggestions for unmatched statement items
        def ai_suggestions
          unless ::Gl::AiTransactionCategorizationService.enabled?
            return render json: {
              success: false,
              error: 'AI categorization is not enabled (ANTHROPIC_API_KEY not set)'
            }, status: :unprocessable_entity
          end

          ai_service = ::Gl::AiTransactionCategorizationService.new(current_company)

          suggestions = []
          @reconciliation.lines.unmatched.statement_items.each do |line|
            suggestion = ai_service.suggest_for_line(line)
            next unless suggestion

            suggestions << {
              line_id: line.id,
              line_description: line.description,
              line_amount: line.amount,
              line_date: line.transaction_date,
              suggested_account: {
                id: suggestion[:account_id],
                code: suggestion[:account_code],
                name: suggestion[:account_name]
              },
              confidence: suggestion[:confidence],
              confidence_percent: (suggestion[:confidence] * 100).round,
              reasoning: suggestion[:reasoning]
            }
          end

          render json: {
            success: true,
            data: suggestions,
            ai_enabled: true,
            rate_limit_remaining: ::Gl::AiCategorizationAttempt.rate_limit_remaining(current_company)
          }
        end

        # POST /api/v1/gl/reconciliations/:id/accept_ai_suggestion
        # Accept an AI suggestion and create an adjustment entry
        def accept_ai_suggestion
          unless @reconciliation.can_edit?
            return render json: {
              success: false,
              error: 'Cannot modify a completed or locked reconciliation'
            }, status: :unprocessable_entity
          end

          line = @reconciliation.lines.find(params[:line_id])
          account = current_company.gl_accounts.find(params[:account_id])

          # Record feedback for learning
          ai_service = ::Gl::AiTransactionCategorizationService.new(current_company)
          ai_service.record_feedback(
            transaction: {
              description: line.description,
              amount: line.amount,
              reference: line.reference,
              date: line.transaction_date
            },
            ai_suggestion: {
              account_id: params[:account_id],
              confidence: params[:confidence].to_f
            },
            user_choice: { account_id: account.id },
            accepted: true
          )

          # Create adjustment with the suggested account
          adjustment = line.create_adjustment!(
            account: account,
            reason: params[:reason] || "AI categorization (#{(params[:confidence].to_f * 100).round}% confidence)"
          )

          if adjustment
            @reconciliation.reload

            render json: {
              success: true,
              data: reconciliation_json(@reconciliation),
              adjustment: line_json(adjustment),
              message: "Applied AI suggestion: #{account.code} - #{account.name}"
            }
          else
            render json: {
              success: false,
              error: 'Failed to apply AI suggestion'
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/reconciliations/:id/ai_stats
        # Get AI categorization statistics
        def ai_stats
          stats = ::Gl::AiCategorizationAttempt.usage_stats(current_company)
          learning_stats = ::Gl::AiCategorizationLearning.where(corporate: current_company)

          render json: {
            success: true,
            data: {
              usage: stats,
              learning: {
                total_feedback: learning_stats.count,
                accepted: learning_stats.accepted.count,
                rejected: learning_stats.rejected.count,
                accuracy_rate: learning_stats.accuracy_rate
              },
              ai_enabled: ::Gl::AiTransactionCategorizationService.enabled?,
              rate_limit_remaining: ::Gl::AiCategorizationAttempt.rate_limit_remaining(current_company)
            }
          }
        end

        # GET /api/v1/gl/reconciliations/:id/suggestions
        # Get match suggestions for unmatched items
        def suggestions
          matcher = ::Gl::ReconciliationMatcher.new(@reconciliation)
          suggestions = matcher.suggest_matches

          render json: {
            success: true,
            data: suggestions.map do |s|
              {
                line: line_json(s[:line]),
                matches: s[:matches].map do |m|
                  {
                    line: line_json(m[:line]),
                    score: m[:score],
                    can_match: m[:can_match]
                  }
                end,
                best_match: s[:best_match] ? {
                  line: line_json(s[:best_match][:line]),
                  score: s[:best_match][:score]
                } : nil,
                auto_match_recommended: s[:auto_match]
              }
            end
          }
        end

        # GET /api/v1/gl/reconciliations/rules
        # List reconciliation rules
        def rules
          rules = current_company.gl_reconciliation_rules
            .includes(:gl_account, :target_account)
            .order(priority: :desc, times_used: :desc)

          # Filter by account
          if params[:account_id].present?
            rules = rules.for_account(params[:account_id])
          end

          # Filter by active status
          rules = rules.active if params[:active] == 'true'

          render json: {
            success: true,
            data: rules.map { |r| rule_json(r) }
          }
        end

        # POST /api/v1/gl/reconciliations/rules
        # Create a reconciliation rule
        def create_rule
          rule = current_company.gl_reconciliation_rules.build(rule_params)

          if rule.save
            render json: {
              success: true,
              data: rule_json(rule)
            }, status: :created
          else
            render json: {
              success: false,
              error: rule.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/reconciliations/rules/:id
        def update_rule
          rule = current_company.gl_reconciliation_rules.find(params[:id])

          if rule.update(rule_params)
            render json: {
              success: true,
              data: rule_json(rule)
            }
          else
            render json: {
              success: false,
              error: rule.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/reconciliations/rules/:id
        def destroy_rule
          rule = current_company.gl_reconciliation_rules.find(params[:id])
          rule.destroy!

          render json: { success: true }
        end

        private

        def set_reconciliation
          @reconciliation = current_company.gl_bank_reconciliations
            .includes(lines: :gl_ledger_line)
            .find(params[:id])
        end

        def reconciliation_params
          params.permit(
            :statement_date,
            :statement_opening_balance,
            :statement_closing_balance,
            :notes
          )
        end

        def rule_params
          params.permit(
            :name,
            :rule_type,
            :match_field,
            :match_operator,
            :match_value,
            :amount_tolerance,
            :target_account_id,
            :gl_account_id,
            :tax_type,
            :default_description,
            :active,
            :priority
          )
        end

        def reconciliation_json(reconciliation, include_lines: false)
          data = {
            id: reconciliation.id,
            account: {
              id: reconciliation.gl_account_id,
              name: reconciliation.gl_account.name,
              code: reconciliation.gl_account.code
            },
            external_provider: reconciliation.external_provider,
            external_tenant_id: reconciliation.external_tenant_id,
            statement_date: reconciliation.statement_date,
            period_start: reconciliation.period_start,
            period_end: reconciliation.period_end,
            statement_opening_balance: reconciliation.statement_opening_balance,
            statement_closing_balance: reconciliation.statement_closing_balance,
            gl_opening_balance: reconciliation.gl_opening_balance,
            gl_closing_balance: reconciliation.gl_closing_balance,
            reconciled_balance: reconciliation.reconciled_balance,
            difference: reconciliation.difference,
            status: reconciliation.status,
            status_badge: reconciliation.status_badge,
            reconciled: reconciliation.reconciled?,
            can_edit: reconciliation.can_edit?,
            can_complete: reconciliation.can_complete?,
            completed_at: reconciliation.completed_at,
            completed_by: reconciliation.completed_by&.name,
            stats: {
              matched_count: reconciliation.matched_count,
              unmatched_count: reconciliation.unmatched_count,
              adjustment_count: reconciliation.adjustment_count,
              total_lines: reconciliation.lines.count
            },
            notes: reconciliation.notes,
            display_name: reconciliation.display_name,
            created_at: reconciliation.created_at,
            updated_at: reconciliation.updated_at
          }

          if include_lines
            data[:lines] = {
              statement_items: reconciliation.lines.statement_items.by_date.map { |l| line_json(l) },
              gl_items: reconciliation.lines.gl_items.by_date.map { |l| line_json(l) },
              matched: reconciliation.matched_lines.map { |l| line_json(l) },
              excluded: reconciliation.excluded_lines.map { |l| line_json(l) },
              adjustments: reconciliation.adjustment_lines.map { |l| line_json(l) }
            }
          end

          data
        end

        def line_json(line)
          {
            id: line.id,
            source: line.source_label,
            is_statement_item: line.statement_item?,
            is_gl_item: line.gl_item?,
            transaction_date: line.transaction_date,
            description: line.description,
            amount: line.amount,
            formatted_amount: line.formatted_amount,
            reference: line.reference,
            status: line.status,
            status_badge: line.status_badge,
            match_type: line.match_type,
            match_confidence: line.match_confidence,
            matched_transaction_ids: line.matched_transaction_ids,
            adjustment_reason: line.adjustment_reason,
            external_transaction_id: line.external_transaction_id,
            gl_ledger_line_id: line.gl_ledger_line_id,
            gl_account_id: line.gl_account_id,
            created_at: line.created_at
          }
        end

        def rule_json(rule)
          {
            id: rule.id,
            name: rule.name,
            rule_type: rule.rule_type,
            match_field: rule.match_field,
            match_operator: rule.match_operator,
            match_value: rule.match_value,
            amount_tolerance: rule.amount_tolerance,
            gl_account: rule.gl_account ? {
              id: rule.gl_account.id,
              name: rule.gl_account.name
            } : nil,
            target_account: rule.target_account ? {
              id: rule.target_account.id,
              name: rule.target_account.name
            } : nil,
            tax_type: rule.tax_type,
            default_description: rule.default_description,
            times_used: rule.times_used,
            last_used_at: rule.last_used_at,
            active: rule.active,
            priority: rule.priority,
            created_at: rule.created_at,
            updated_at: rule.updated_at
          }
        end

        def current_company
          @current_company ||= Corporate.find(params[:corporate_id] || current_user.corporate_id)
        end
      end
    end
  end
end
