# frozen_string_literal: true

# SSoT: Health Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - show: GET /api/v1/contacts/health (quick health score)
#   - invalid_entity_types: GET /api/v1/contacts/health/invalid_entity_types
#   - price_only_with_xero: GET /api/v1/contacts/health/price_only_with_xero
#   - company_with_first_name: GET /api/v1/contacts/health/company_with_first_name
#   - person_without_name: GET /api/v1/contacts/health/person_without_name
#   - missing_contact_info: GET /api/v1/contacts/health/missing_contact_info
#   - connected_mailboxes: GET /api/v1/contacts/health/connected_mailboxes
#
module Api
  module V1
    module Contacts
      class HealthController < ApplicationController
        before_action :authorize_request

        # GET /api/v1/contacts/health
        # Quick health score for header display
        def show
          checker = HealthChecks::ContactsCheck.new
          results = checker.run_all

          health_score = HealthChecks::BaseCheck.calculate_health_score(results)
          total_issues = results.sum { |r| r[:count] || 0 }

          render json: {
            success: true,
            health_score: health_score,
            total_issues: total_issues,
            checked_at: Time.current.iso8601
          }
        rescue => e
          Rails.logger.error("Contacts health check error: #{e.message}")
          render json: { success: false, health_score: nil, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/invalid_entity_types
        # Find contacts with invalid or nil entity_type
        def invalid_entity_types
          valid_types = Contact::ENTITY_TYPES
          invalid = Contact.where.not(entity_type: valid_types)
            .or(Contact.where(entity_type: nil))

          render json: {
            success: true,
            total_count: invalid.count,
            items: invalid.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                entity_type: c.entity_type,
                is_active: c.is_active,
                has_xero: c.xero_id.present?,
                issue: "Invalid entity_type: '#{c.entity_type}'. Valid values: #{valid_types.join(', ')}"
              }
            }
          }
        rescue => e
          Rails.logger.error("Invalid entity types check error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/price_only_with_xero
        # Find price_only contacts that are synced to Xero (should never happen)
        def price_only_with_xero
          # SSoT: Use contact_external_links for Xero sync status
          violations = Contact.where(entity_type: "price_only")
            .joins(:external_links).where(contact_external_links: { source: "xero" }).distinct

          render json: {
            success: true,
            total_count: violations.count,
            items: violations.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                xero_id: c.xero_id,
                xero_contact_types: c.xero_contact_types,
                is_active: c.is_active,
                issue: "Price-only contacts cannot sync to Xero (not real entities)"
              }
            }
          }
        rescue => e
          Rails.logger.error("Price-only with Xero check error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/company_with_first_name
        # Find companies/trusts/price_only with first_name or last_name set
        def company_with_first_name
          violations = Contact.where(entity_type: ["company", "trust", "price_only"])
            .where("first_name IS NOT NULL OR last_name IS NOT NULL")

          render json: {
            success: true,
            total_count: violations.count,
            items: violations.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                entity_type: c.entity_type,
                first_name: c.first_name,
                last_name: c.last_name,
                company_name_or_trust: c.company_name_or_trust,
                is_active: c.is_active,
                issue: "#{c.entity_type.humanize} contacts should only have company_name_or_trust or display_name, not first_name/last_name"
              }
            }
          }
        rescue => e
          Rails.logger.error("Company with first name check error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/person_without_name
        # Find person/sole_trader contacts without first_name
        def person_without_name
          violations = Contact.where(entity_type: ["person", "sole_trader"])
            .where("first_name IS NULL OR first_name = ''")

          render json: {
            success: true,
            total_count: violations.count,
            items: violations.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                entity_type: c.entity_type,
                first_name: c.first_name,
                last_name: c.last_name,
                is_active: c.is_active,
                issue: "#{c.entity_type.humanize} contacts require at least a first_name"
              }
            }
          }
        rescue => e
          Rails.logger.error("Person without name check error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/missing_contact_info
        # Find contacts (excluding price_only) without mobile or email
        def missing_contact_info
          # Exclude price_only - they're just pricebook placeholders
          violations = Contact.where.not(entity_type: "price_only")
            .where("(mobile_phone IS NULL OR mobile_phone = '') AND (email IS NULL OR email = '')")

          render json: {
            success: true,
            total_count: violations.count,
            items: violations.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                entity_type: c.entity_type,
                mobile_phone: c.mobile_phone,
                email: c.email,
                is_active: c.is_active,
                issue: "Contact has no mobile phone or email - at least one contact method is required"
              }
            }
          }
        rescue => e
          Rails.logger.error("Missing contact info check error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/health/connected_mailboxes
        # Returns list of connected org mailboxes for employee extraction
        def connected_mailboxes
          # Get org credentials and their configured mailboxes
          org_mailboxes = []

          # SSoT: Use MicrosoftCredential for app credentials
          MicrosoftCredential.app_credentials.connected.each do |org_cred|
            sync_config = org_cred.sync_config || {}
            mailbox_emails = sync_config["mailbox_emails"] || []

            mailbox_emails.each do |email|
              org_mailboxes << {
                org_name: org_cred.name,
                org_id: org_cred.id,
                email: email
              }
            end
          end

          render json: {
            success: true,
            mailboxes: org_mailboxes
          }
        rescue => e
          Rails.logger.error("Connected mailboxes error: #{e.message}")
          render json: { success: false, error: e.message }, status: :internal_server_error
        end
      end
    end
  end
end
