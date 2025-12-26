module Api
  module V1
    class SmRecurringTaskDefinitionsController < ApplicationController
      before_action :set_definition, only: [:show, :update, :destroy, :pause, :resume, :cancel, :generate_now]

      # GET /api/v1/sm_recurring_task_definitions
      def index
        definitions = SmRecurringTaskDefinition.includes(:assigned_user, :job, :created_by)
                                               .order(created_at: :desc)

        # Filter by status if provided
        if params[:status].present?
          definitions = definitions.where(status: params[:status])
        end

        # Filter by active state
        if params[:is_active].present?
          definitions = definitions.where(is_active: params[:is_active] == 'true')
        end

        render json: {
          success: true,
          sm_recurring_task_definitions: definitions.map { |d| serialize_definition(d) },
          meta: {
            total_count: definitions.count,
            active_count: definitions.active.count,
            paused_count: definitions.paused.count
          }
        }
      end

      # GET /api/v1/sm_recurring_task_definitions/summary
      def summary
        render json: {
          success: true,
          summary: {
            total: SmRecurringTaskDefinition.count,
            active: SmRecurringTaskDefinition.active.count,
            paused: SmRecurringTaskDefinition.paused.count,
            completed: SmRecurringTaskDefinition.where(status: 'completed').count,
            cancelled: SmRecurringTaskDefinition.where(status: 'cancelled').count,
            upcoming_this_week: SmRecurringTaskDefinition.active
                                 .where('next_generation_date <= ?', Date.current + 7.days)
                                 .count,
            tasks_generated_today: SmTask.recurring
                                         .where('created_at >= ?', Date.current.beginning_of_day)
                                         .count
          }
        }
      end

      # GET /api/v1/sm_recurring_task_definitions/:id
      def show
        render json: {
          success: true,
          sm_recurring_task_definition: serialize_definition(@definition, include_history: true)
        }
      end

      # POST /api/v1/sm_recurring_task_definitions
      def create
        definition = SmRecurringTaskDefinition.new(definition_params)
        definition.created_by = current_user
        definition.updated_by = current_user

        if definition.save
          render json: {
            success: true,
            sm_recurring_task_definition: serialize_definition(definition),
            message: 'Recurring task definition created successfully'
          }, status: :created
        else
          render json: {
            success: false,
            error: definition.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/sm_recurring_task_definitions/:id
      def update
        @definition.updated_by = current_user

        if @definition.update(definition_params)
          render json: {
            success: true,
            sm_recurring_task_definition: serialize_definition(@definition),
            message: 'Recurring task definition updated successfully'
          }
        else
          render json: {
            success: false,
            error: @definition.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_recurring_task_definitions/:id
      def destroy
        if @definition.destroy
          render json: {
            success: true,
            message: 'Recurring task definition deleted successfully'
          }
        else
          render json: {
            success: false,
            error: 'Failed to delete recurring task definition'
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_recurring_task_definitions/:id/pause
      def pause
        @definition.pause!
        render json: {
          success: true,
          sm_recurring_task_definition: serialize_definition(@definition),
          message: 'Recurring task definition paused'
        }
      end

      # POST /api/v1/sm_recurring_task_definitions/:id/resume
      def resume
        @definition.resume!
        render json: {
          success: true,
          sm_recurring_task_definition: serialize_definition(@definition),
          message: 'Recurring task definition resumed'
        }
      end

      # POST /api/v1/sm_recurring_task_definitions/:id/cancel
      def cancel
        @definition.cancel!
        render json: {
          success: true,
          sm_recurring_task_definition: serialize_definition(@definition),
          message: 'Recurring task definition cancelled'
        }
      end

      # POST /api/v1/sm_recurring_task_definitions/:id/generate_now
      def generate_now
        tasks = @definition.generate_tasks_for_period!

        render json: {
          success: true,
          sm_recurring_task_definition: serialize_definition(@definition),
          generated_tasks: tasks.map { |t| { id: t.id, name: t.name, start_date: t.start_date } },
          message: "Generated #{tasks.count} task(s)"
        }
      end

      private

      def set_definition
        @definition = SmRecurringTaskDefinition.find(params[:id])
      end

      def definition_params
        params.require(:sm_recurring_task_definition).permit(
          :name,
          :description,
          :is_active,
          :status,
          :frequency,
          :frequency_interval,
          :day_of_month,
          :day_of_week,
          :start_date,
          :end_date,
          :occurrences_limit,
          :advance_days,
          :assignment_type,
          :assigned_user_id,
          :assigned_role,
          :default_duration_days,
          :trade,
          :stage,
          :checklist_id,
          :job_id,
          :notify_on_create,
          :notify_on_due,
          skip_config: [:skip_weekends, :skip_holidays, :skip_user_leave]
        )
      end

      def serialize_definition(definition, include_history: false)
        data = {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          is_active: definition.is_active,
          status: definition.status,
          frequency: definition.frequency,
          frequency_interval: definition.frequency_interval,
          frequency_description: definition.frequency_description,
          day_of_month: definition.day_of_month,
          day_of_week: definition.day_of_week,
          start_date: definition.start_date,
          end_date: definition.end_date,
          occurrences_limit: definition.occurrences_limit,
          occurrences_count: definition.occurrences_count,
          remaining_occurrences: definition.remaining_occurrences,
          advance_days: definition.advance_days,
          last_generated_for_date: definition.last_generated_for_date,
          next_generation_date: definition.next_generation_date,
          assignment_type: definition.assignment_type,
          assigned_user_id: definition.assigned_user_id,
          assigned_user_name: definition.assigned_user&.name,
          assigned_role: definition.assigned_role,
          assignee_name: definition.assignee_name,
          default_duration_days: definition.default_duration_days,
          trade: definition.trade,
          stage: definition.stage,
          checklist_id: definition.checklist_id,
          job_id: definition.job_id,
          job_name: definition.job&.name,
          skip_config: definition.skip_config,
          notify_on_create: definition.notify_on_create,
          notify_on_due: definition.notify_on_due,
          created_by_id: definition.created_by_id,
          created_by_name: definition.created_by&.name,
          created_at: definition.created_at,
          updated_at: definition.updated_at
        }

        if include_history
          data[:generated_tasks] = definition.generated_tasks
                                             .order(created_at: :desc)
                                             .limit(10)
                                             .map { |t|
                                               {
                                                 id: t.id,
                                                 name: t.name,
                                                 start_date: t.start_date,
                                                 status: t.status,
                                                 recurring_sequence: t.recurring_sequence,
                                                 created_at: t.created_at
                                               }
                                             }
        end

        data
      end
    end
  end
end
