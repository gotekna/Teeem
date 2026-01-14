# frozen_string_literal: true

# EmailDnsVerifyJob - Verifies DNS records are present and correct in Cloudflare
#
# This job can be run:
# - On-demand when user clicks "Verify DNS" button
# - Periodically via scheduled task to check all active subscriptions
#
# Usage:
#   EmailDnsVerifyJob.perform_later(subscription.id)
#   EmailDnsVerifyJob.verify_all  # Class method to verify all
#
class EmailDnsVerifyJob < ApplicationJob
  queue_as :default

  retry_on CloudflareService::RateLimitError, wait: :polynomially_longer, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  class << self
    # Verify DNS for all active subscriptions
    def verify_all
      EmailSubscription.active.find_each do |subscription|
        perform_later(subscription.id)
      end
    end
  end

  def perform(email_subscription_id)
    @subscription = EmailSubscription.find(email_subscription_id)
    @domain = @subscription.domain

    Rails.logger.info "[EmailDnsVerifyJob] Verifying DNS for #{@domain}"

    # Check if Cloudflare is configured
    unless CloudflareCredential.configured?
      Rails.logger.warn "[EmailDnsVerifyJob] Cloudflare not configured"
      return
    end

    @cloudflare = CloudflareService.new

    # Check if zone exists
    unless @cloudflare.zone_exists?(@domain)
      @subscription.update!(dns_status: 'zone_not_found')
      @subscription.email_dns_records.update_all(status: :missing)
      return
    end

    # Verify each record
    verify_records

    # Update subscription status
    update_subscription_status

    Rails.logger.info "[EmailDnsVerifyJob] Completed DNS verification for #{@domain}"
  end

  private

  def verify_records
    zone_id = @cloudflare.zone_id_for(@domain)
    existing_records = @cloudflare.list_dns_records(zone_id)

    @subscription.email_dns_records.each do |dns_record|
      verify_record(dns_record, existing_records)
    end
  end

  def verify_record(dns_record, existing_records)
    name = dns_record.full_name
    type = dns_record.record_type.upcase

    # Find matching record in Cloudflare
    found = existing_records.find do |r|
      r["type"] == type && r["name"] == name
    end

    if found.nil?
      dns_record.mark_missing!
      Rails.logger.warn "[EmailDnsVerifyJob] Missing record: #{name} (#{type})"
    elsif found["content"] != dns_record.content
      # Content mismatch - record exists but has different value
      dns_record.update!(
        status: :error,
        error_message: "Content mismatch. Expected: #{dns_record.content}, Actual: #{found['content']}"
      )
      Rails.logger.warn "[EmailDnsVerifyJob] Content mismatch for #{name}"
    else
      # Update Cloudflare ID if we didn't have it
      dns_record.cloudflare_record_id ||= found["id"]
      dns_record.mark_verified!
      Rails.logger.info "[EmailDnsVerifyJob] Verified: #{name}"
    end
  end

  def update_subscription_status
    records = @subscription.email_dns_records.reload

    status = if records.empty?
               'pending'
             elsif records.all?(&:status_verified?)
               'verified'
             elsif records.all? { |r| r.status_created? || r.status_verified? }
               'provisioned'
             elsif records.any?(&:status_missing?)
               'missing'
             elsif records.any?(&:status_error?)
               'error'
             else
               'partial'
             end

    @subscription.update!(dns_status: status)
  end
end
