# SmRecurringTaskGenerationJob
#
# Runs daily to generate tasks from recurring task definitions.
# Scheduled via SolidQueue (config/recurring.yml) at 6:30 AM Brisbane time.
#
# See: SmRecurringTaskDefinition model for generation logic
#
class SmRecurringTaskGenerationJob < ApplicationJob
  queue_as :default

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: SmRecurringTaskDefinition and SmTask have tenant context requirements.
  # Without tenant, created SmTask records get nil tenant_id and definition queries
  # return cross-tenant data (require_tenant=false).
  def perform
    Rails.logger.info "[RecurringTasks] Starting task generation job"

    stats = {
      definitions_processed: 0,
      tasks_generated: 0,
      definitions_completed: 0,
      errors: 0
    }

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        generate_for_tenant(stats)
      end
    end

    Rails.logger.info "[RecurringTasks] Job complete. Stats: #{stats.inspect}"
    stats
  end

  private

  def generate_for_tenant(stats)
    # Find all definitions due for generation
    definitions = SmRecurringTaskDefinition.due_for_generation
    return if definitions.empty?

    Rails.logger.info "[RecurringTasks] Found #{definitions.count} definitions due for #{ActsAsTenant.current_tenant.name}"

    definitions.find_each do |definition|
      begin
        tasks = definition.generate_tasks_for_period!
        stats[:definitions_processed] += 1
        stats[:tasks_generated] += tasks.count

        if definition.status == 'completed'
          stats[:definitions_completed] += 1
        end

        if tasks.any?
          Rails.logger.info "[RecurringTasks] Generated #{tasks.count} task(s) from '#{definition.name}'"
        end
      rescue StandardError => e
        stats[:errors] += 1
        Rails.logger.error "[RecurringTasks] Error generating tasks for '#{definition.name}' (ID: #{definition.id}): #{e.message}"
        Rails.logger.error e.backtrace.first(5).join("\n")

        # Report to Sentry if available
        Sentry.capture_exception(e, extra: { definition_id: definition.id, definition_name: definition.name }) if defined?(Sentry)
      end
    end
  end
end
