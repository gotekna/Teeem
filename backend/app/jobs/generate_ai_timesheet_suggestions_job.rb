# frozen_string_literal: true

# GenerateAiTimesheetSuggestionsJob - Daily AI timesheet suggestion generation
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Runs daily at 6am to generate timesheet suggestions for yesterday's work.
# Scheduled via solid_queue recurring tasks.
#
class GenerateAiTimesheetSuggestionsJob < ApplicationJob
  include DeduplicatableJob
  queue_as :default

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: AiTimesheetGeneratorService queries WorkerProfile/SmTaskPhoto/Job
  # which have acts_as_tenant. Without tenant context, generates cross-tenant suggestions.
  def perform(date: nil)
    date ||= Date.yesterday

    Rails.logger.info "[AiTimesheetSuggestions] Generating suggestions for #{date}"

    all_results = { total_suggestions: 0, workers_processed: 0, errors: [] }

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        service = AiTimesheetGeneratorService.new
        result = service.generate_for_date(date: date)
        all_results[:total_suggestions] += (result[:total_suggestions] || 0)
        all_results[:workers_processed] += (result[:workers_processed] || 0)
        all_results[:errors].concat(result[:errors] || [])
      end
    end

    Rails.logger.info "[AiTimesheetSuggestions] Generated #{all_results[:total_suggestions]} suggestions for #{all_results[:workers_processed]} workers"

    if all_results[:errors].any?
      Rails.logger.warn "[AiTimesheetSuggestions] Errors: #{all_results[:errors].join(', ')}"
    end

    all_results
  end
end
