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
  queue_as :default

  def perform(date: nil)
    date ||= Date.yesterday

    Rails.logger.info "[AiTimesheetSuggestions] Generating suggestions for #{date}"

    service = AiTimesheetGeneratorService.new
    result = service.generate_for_date(date: date)

    Rails.logger.info "[AiTimesheetSuggestions] Generated #{result[:total_suggestions]} suggestions for #{result[:workers_processed]} workers"

    if result[:errors].any?
      Rails.logger.warn "[AiTimesheetSuggestions] Errors: #{result[:errors].join(', ')}"
    end

    result
  end
end
