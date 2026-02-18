# frozen_string_literal: true

# Recurring job: matches Xero-imported POs to native POs and updates
# the Xero bill's Reference field with the PO number.
#
# Runs daily at 7am Brisbane time. Safe to re-run (idempotent).
# See XeroBillPoMatcherService for matching logic.
class XeroBillPoMatchJob < ApplicationJob
  queue_as :xero_sync

  def perform(_options = {})
    Rails.logger.info("[XeroBillPoMatchJob] Starting automatic Xero bill → PO matching")

    service = XeroBillPoMatcherService.new
    result = service.match_and_update!

    Rails.logger.info("[XeroBillPoMatchJob] Complete: matched=#{result[:matched]}, updated_xero=#{result[:updated_xero]}, skipped=#{result[:skipped]}, errors=#{result[:errors].length}")
  rescue XeroApiClient::AuthenticationError => e
    Rails.logger.error("[XeroBillPoMatchJob] Auth failed - Xero may need reconnection: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[XeroBillPoMatchJob] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  end
end
