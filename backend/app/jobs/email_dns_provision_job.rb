# frozen_string_literal: true

# EmailDnsProvisionJob - Provisions DNS records for email subscriptions via Cloudflare
#
# This job is queued when a new email subscription is created. It:
# 1. Checks if the domain exists in Cloudflare
# 2. Creates all required DNS records (MX, SPF, DKIM, DMARC, autodiscover)
# 3. Creates EmailDnsRecord entries for tracking
# 4. Updates the subscription's dns_status
#
# Usage:
#   EmailDnsProvisionJob.perform_later(subscription.id)
#
class EmailDnsProvisionJob < ApplicationJob
  queue_as :default

  retry_on CloudflareService::RateLimitError, wait: :polynomially_longer, attempts: 5
  retry_on CloudflareService::ApiError, wait: 30.seconds, attempts: 3

  discard_on ActiveRecord::RecordNotFound

  def perform(email_subscription_id)
    @subscription = EmailSubscription.find(email_subscription_id)
    @domain = @subscription.domain

    Rails.logger.info "[EmailDnsProvisionJob] Starting DNS provisioning for #{@domain}"

    # Check if Cloudflare is configured
    unless CloudflareCredential.configured?
      Rails.logger.warn "[EmailDnsProvisionJob] Cloudflare not configured, skipping DNS provisioning"
      @subscription.update!(dns_status: 'not_configured')
      return
    end

    @cloudflare = CloudflareService.new

    # Check if zone exists in Cloudflare
    unless @cloudflare.zone_exists?(@domain)
      Rails.logger.error "[EmailDnsProvisionJob] Zone not found for #{@domain}"
      @subscription.update!(dns_status: 'zone_not_found')
      return
    end

    # Provision DNS records
    provision_dns_records

    # Update subscription status
    update_subscription_status

    Rails.logger.info "[EmailDnsProvisionJob] Completed DNS provisioning for #{@domain}"
  end

  private

  def provision_dns_records
    zone_id = @cloudflare.zone_id_for(@domain)
    records = EmailDnsRecord.default_records_for(@domain)

    records.each do |record_def|
      provision_record(zone_id, record_def)
    end
  end

  def provision_record(zone_id, record_def)
    # Find or create EmailDnsRecord
    dns_record = @subscription.email_dns_records.find_or_initialize_by(
      record_type: record_def[:record_type],
      name: record_def[:name]
    )
    dns_record.content = record_def[:content]
    dns_record.priority = record_def[:priority]
    dns_record.cloudflare_zone_id = zone_id
    dns_record.save!

    # Skip if already created in Cloudflare
    if dns_record.cloudflare_record_id.present? && dns_record.status_created?
      Rails.logger.info "[EmailDnsProvisionJob] Record already exists: #{record_def[:name]}"
      return
    end

    begin
      # Create record in Cloudflare
      name = record_def[:name] == '@' ? @domain : "#{record_def[:name]}.#{@domain}"

      result = @cloudflare.create_dns_record(
        zone_id,
        type: record_def[:record_type],
        name: name,
        content: record_def[:content],
        priority: record_def[:priority],
        proxied: false
      )

      dns_record.mark_created!(
        cloudflare_record_id: result["id"],
        zone_id: zone_id
      )

      Rails.logger.info "[EmailDnsProvisionJob] Created #{record_def[:record_type]} record: #{name}"
    rescue CloudflareService::RecordExistsError => e
      # Record already exists in Cloudflare - try to find and link it
      existing = find_existing_record(zone_id, record_def)
      if existing
        dns_record.mark_created!(
          cloudflare_record_id: existing["id"],
          zone_id: zone_id
        )
        Rails.logger.info "[EmailDnsProvisionJob] Linked existing record: #{record_def[:name]}"
      else
        dns_record.mark_error!("Record exists but could not be linked")
      end
    rescue CloudflareService::ApiError => e
      dns_record.mark_error!(e.message)
      Rails.logger.error "[EmailDnsProvisionJob] Failed to create record #{record_def[:name]}: #{e.message}"
    end
  end

  def find_existing_record(zone_id, record_def)
    name = record_def[:name] == '@' ? @domain : "#{record_def[:name]}.#{@domain}"
    records = @cloudflare.list_dns_records(zone_id, type: record_def[:record_type])
    records.find { |r| r["name"] == name }
  end

  def update_subscription_status
    records = @subscription.email_dns_records.reload

    if records.all?(&:status_created?) || records.all?(&:status_verified?)
      @subscription.update!(dns_status: 'provisioned')
    elsif records.any?(&:status_error?)
      @subscription.update!(dns_status: 'error')
    else
      @subscription.update!(dns_status: 'partial')
    end
  end
end
