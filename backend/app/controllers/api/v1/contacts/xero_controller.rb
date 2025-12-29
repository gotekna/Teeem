# frozen_string_literal: true

# SSoT: Xero Controller - Converted from concerns/contacts/xero_sync.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - link_tenant: POST /api/v1/contacts/xero/:contact_id/link_tenant
#   - link_contact: POST /api/v1/contacts/xero/:contact_id/link_contact
#   - sync_from: POST /api/v1/contacts/xero/:contact_id/sync_from
#   - sync_to: POST /api/v1/contacts/xero/:contact_id/sync_to
#
module Api
  module V1
    module Contacts
      class XeroController < ApplicationController
        before_action :authorize_request
        before_action :set_contact

        # POST /api/v1/contacts/xero/:contact_id/link_tenant
        # Manually link a contact to a specific Xero contact in a specific tenant
        def link_tenant
          tenant_id = params[:tenant_id]
          xero_contact_id = params[:xero_contact_id]

          unless tenant_id.present? && xero_contact_id.present?
            return render json: {
              success: false,
              error: "tenant_id and xero_contact_id are required"
            }, status: :bad_request
          end

          # Check if already linked to this tenant
          existing_link = @contact.xero_links.find_by(tenant_id: tenant_id)
          if existing_link
            return render json: {
              success: false,
              error: "Contact is already linked to this Xero organization",
              existing_link_id: existing_link.id
            }, status: :unprocessable_entity
          end

          # Verify the Xero contact exists
          client = XeroApiClient.new
          result = client.get("Contacts/#{xero_contact_id}", tenant_id: tenant_id)

          unless result[:success]
            return render json: {
              success: false,
              error: "Failed to verify Xero contact: #{result[:error]}"
            }, status: :unprocessable_entity
          end

          xero_contact = result[:data]["Contacts"]&.first

          unless xero_contact
            return render json: {
              success: false,
              error: "Xero contact not found"
            }, status: :not_found
          end

          # Get sync config for tenant name
          config = SyncConfiguration.find_by(xero_tenant_id: tenant_id)

          # Create the link
          link = @contact.xero_links.create!(
            source: "xero",
            tenant_id: tenant_id,
            tenant_name: config&.xero_tenant_name || xero_contact["Name"] || "Unknown",
            external_contact_id: xero_contact_id,
            sync_enabled: true,
            sync_direction: "bidirectional",
            match_type: "manual",
            needs_review: false,
            last_synced_at: Time.current
          )

          # Optionally sync data from Xero
          begin
            sync_service = XeroContactSyncService.new(tenant_id: tenant_id)
            sync_service.send(:sync_matched_contact, @contact, xero_contact, link)
          rescue StandardError => e
            Rails.logger.error("Failed to sync after manual link: #{e.message}")
          end

          render json: {
            success: true,
            message: "Contact linked to Xero successfully",
            xero_link: {
              id: link.id,
              tenant_id: link.tenant_id,
              tenant_name: link.tenant_name,
              external_contact_id: link.external_contact_id,
              xero_contact_name: xero_contact["Name"]
            }
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            errors: e.record.errors.full_messages
          }, status: :unprocessable_entity
        rescue StandardError => e
          render json: {
            success: false,
            error: "Failed to link contact: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/xero/:contact_id/link_contact
        # Manually link a TEEEM contact to a Xero contact (legacy xero_id method)
        def link_contact
          xero_id = params[:xero_id]

          if xero_id.blank?
            return render json: {
              success: false,
              error: "xero_id is required"
            }, status: :bad_request
          end

          begin
            # Fetch the Xero contact to verify it exists and get its details
            client = XeroApiClient.new
            result = client.get("Contacts/#{xero_id}")

            unless result[:success]
              return render json: {
                success: false,
                error: "Failed to fetch Xero contact"
              }, status: :unprocessable_entity
            end

            xero_contact = result[:data]["Contacts"]&.first

            unless xero_contact
              return render json: {
                success: false,
                error: "Xero contact not found"
              }, status: :not_found
            end

            # Update the contact with the Xero ID and sync timestamp
            @contact.update!(
              xero_id: xero_contact["ContactID"],
              last_synced_at: Time.current,
              xero_sync_error: nil,
              sync_with_xero: true
            )

            # Log the manual link activity
            ContactActivity.create!(
              contact: @contact,
              activity_type: "linked_to_xero",
              description: "Manually linked to Xero contact: #{xero_contact['Name']}",
              metadata: {
                xero_contact_id: xero_contact["ContactID"],
                xero_contact_name: xero_contact["Name"],
                linked_via: "manual"
              },
              performed_by: @contact,
              occurred_at: Time.current
            )

            render json: {
              success: true,
              message: "Successfully linked contact to Xero: #{xero_contact['Name']}",
              contact: @contact.as_json(
                only: [:id, :display_name, :xero_id, :last_synced_at, :sync_with_xero]
              ),
              xero_contact: {
                xero_id: xero_contact["ContactID"],
                name: xero_contact["Name"],
                email: xero_contact["EmailAddress"],
                tax_number: xero_contact["TaxNumber"]
              }
            }
          rescue ActiveRecord::RecordInvalid => e
            render json: {
              success: false,
              error: "Failed to link contact: #{e.message}"
            }, status: :unprocessable_entity
          rescue => e
            Rails.logger.error("Link Xero contact error: #{e.message}")
            render json: {
              success: false,
              error: "Failed to link contact: #{e.message}"
            }, status: :internal_server_error
          end
        end

        # POST /api/v1/contacts/xero/:contact_id/sync_from
        # Sync a contact from Xero (pull data from Xero into TEEEM)
        def sync_from
          tenant_id = params[:tenant_id]

          # Find the xero link to sync from
          link = if tenant_id.present?
            @contact.xero_links.find_by(tenant_id: tenant_id)
          else
            @contact.xero_links.first
          end

          # Fall back to legacy xero_id if no link found
          if link.nil? && @contact.xero_id.present?
            return sync_from_xero_legacy
          end

          unless link
            return render json: {
              success: false,
              error: "Contact is not linked to any Xero organization"
            }, status: :unprocessable_entity
          end

          begin
            sync_service = XeroContactSyncService.new(tenant_id: link.tenant_id)
            result = sync_service.sync_from_xero(link)

            if result[:success]
              render json: {
                success: true,
                message: "Contact synced from Xero successfully",
                contact: result[:contact].as_json(
                  only: [:id, :display_name, :first_name, :last_name, :email, :mobile_phone, :office_phone,
                         :xero_id, :last_synced_at, :sync_with_xero, :xero_sync_error,
                         :tax_number, :bank_bsb, :bank_account_number, :bank_account_name,
                         :accounts_payable_outstanding, :accounts_receivable_outstanding]
                )
              }
            else
              render json: {
                success: false,
                error: result[:error] || "Sync failed"
              }, status: :unprocessable_entity
            end
          rescue XeroApiClient::AuthenticationError => e
            render json: {
              success: false,
              error: "Not authenticated with Xero. Please reconnect."
            }, status: :unauthorized
          rescue => e
            Rails.logger.error("Sync from Xero error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
            render json: {
              success: false,
              error: "Sync failed: #{e.message}"
            }, status: :internal_server_error
          end
        end

        # POST /api/v1/contacts/xero/:contact_id/sync_to
        # Push contact changes from TEEEM to Xero
        def sync_to
          tenant_id = params[:tenant_id]

          # Find the xero link to sync to
          link = if tenant_id.present?
            @contact.xero_links.find_by(tenant_id: tenant_id)
          else
            @contact.xero_links.first
          end

          unless link&.external_contact_id.present?
            return render json: {
              success: false,
              error: "Contact is not linked to any Xero organization"
            }, status: :unprocessable_entity
          end

          begin
            sync_service = XeroContactSyncService.new(tenant_id: link.tenant_id)
            result = sync_service.sync_to_xero(@contact, link)

            if result[:success]
              render json: {
                success: true,
                message: "Contact pushed to Xero successfully",
                contact: @contact.reload.as_json(
                  only: [:id, :display_name, :first_name, :last_name, :email, :mobile_phone, :office_phone,
                         :xero_id, :last_synced_at, :sync_with_xero, :xero_sync_error,
                         :tax_number, :bank_bsb, :bank_account_number, :bank_account_name]
                )
              }
            else
              render json: {
                success: false,
                error: result[:error] || "Failed to push contact to Xero"
              }, status: :unprocessable_entity
            end
          rescue XeroApiClient::AuthenticationError => e
            render json: {
              success: false,
              error: "Not authenticated with Xero. Please reconnect."
            }, status: :unauthorized
          rescue => e
            Rails.logger.error("Sync to Xero error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
            render json: {
              success: false,
              error: "Sync failed: #{e.message}"
            }, status: :internal_server_error
          end
        end

        private

        def set_contact
          @contact = Contact.find(params[:contact_id])
        rescue ActiveRecord::RecordNotFound
          render json: {
            success: false,
            error: "Contact not found"
          }, status: :not_found
        end

        # Legacy sync using xero_id field (for contacts not yet migrated to xero_links)
        def sync_from_xero_legacy
          client = XeroApiClient.new
          result = client.get("Contacts/#{@contact.xero_id}")

          unless result[:success]
            return render json: {
              success: false,
              error: "Failed to fetch contact from Xero"
            }, status: :unprocessable_entity
          end

          xero_contact = result[:data]["Contacts"]&.first

          unless xero_contact
            return render json: {
              success: false,
              error: "Contact not found in Xero"
            }, status: :not_found
          end

          # Update basic contact info from Xero
          updates = {}
          updates[:email] = xero_contact["EmailAddress"] if xero_contact["EmailAddress"].present?
          updates[:tax_number] = xero_contact["TaxNumber"] if xero_contact["TaxNumber"].present?
          updates[:last_synced_at] = Time.current
          updates[:xero_sync_error] = nil

          # Update phone numbers from Xero
          phones = xero_contact["Phones"] || []
          mobile = phones.find { |p| p["PhoneType"] == "MOBILE" }
          office = phones.find { |p| p["PhoneType"] == "DEFAULT" }
          updates[:mobile_phone] = mobile["PhoneNumber"] if mobile&.dig("PhoneNumber").present?
          updates[:office_phone] = office["PhoneNumber"] if office&.dig("PhoneNumber").present?

          # Update financial balances
          if xero_contact["Balances"]
            ap = xero_contact.dig("Balances", "AccountsPayable")
            ar = xero_contact.dig("Balances", "AccountsReceivable")
            updates[:accounts_payable_outstanding] = ap["Outstanding"] if ap
            updates[:accounts_payable_overdue] = ap["Overdue"] if ap
            updates[:accounts_receivable_outstanding] = ar["Outstanding"] if ar
            updates[:accounts_receivable_overdue] = ar["Overdue"] if ar
          end

          @contact.update!(updates)

          # Sync addresses from Xero
          sync_addresses_from_xero(xero_contact["Addresses"])

          render json: {
            success: true,
            message: "Contact synced from Xero successfully (legacy)",
            contact: @contact.reload.as_json(
              only: [:id, :display_name, :first_name, :last_name, :email, :mobile_phone, :office_phone,
                     :xero_id, :last_synced_at, :sync_with_xero, :xero_sync_error,
                     :tax_number, :accounts_payable_outstanding, :accounts_receivable_outstanding],
              include: { contact_addresses: { only: [:id, :address_type, :line1, :line2, :line3, :line4, :city, :region, :postal_code, :country] } }
            )
          }
        rescue => e
          Rails.logger.error("Legacy sync from Xero error: #{e.message}")
          render json: {
            success: false,
            error: "Sync failed: #{e.message}"
          }, status: :internal_server_error
        end

        # Sync addresses from Xero to TEEEM (TEEEM is source of truth)
        def sync_addresses_from_xero(xero_addresses)
          return unless xero_addresses.is_a?(Array)

          xero_addresses.each do |xero_addr|
            address_type = xero_addr["AddressType"]
            next unless address_type.present? && ContactAddress::ADDRESS_TYPES.include?(address_type)

            existing = @contact.contact_addresses.find_by(address_type: address_type)

            if existing
              # Only update if TEEEM address is empty
              if existing.line1.blank? && existing.city.blank?
                existing.update!(
                  line1: xero_addr["AddressLine1"],
                  line2: xero_addr["AddressLine2"],
                  line3: xero_addr["AddressLine3"],
                  line4: xero_addr["AddressLine4"],
                  city: xero_addr["City"],
                  region: xero_addr["Region"],
                  postal_code: xero_addr["PostalCode"],
                  country: xero_addr["Country"]
                )
              end
            else
              # Create from Xero if has data
              if xero_addr["AddressLine1"].present? || xero_addr["City"].present?
                @contact.contact_addresses.create!(
                  address_type: address_type,
                  line1: xero_addr["AddressLine1"],
                  line2: xero_addr["AddressLine2"],
                  line3: xero_addr["AddressLine3"],
                  line4: xero_addr["AddressLine4"],
                  city: xero_addr["City"],
                  region: xero_addr["Region"],
                  postal_code: xero_addr["PostalCode"],
                  country: xero_addr["Country"]
                )
              end
            end
          end
        end
      end
    end
  end
end
