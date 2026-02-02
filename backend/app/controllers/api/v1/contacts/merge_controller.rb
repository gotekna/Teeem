# frozen_string_literal: true

# SSoT: Merge Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - create: POST /api/v1/contacts/merge (merge contacts)
#   - duplicates: GET /api/v1/contacts/merge/duplicates (find possible duplicates)
#
module Api
  module V1
    module Contacts
      class MergeController < ApplicationController
        before_action :authorize_request

        # POST /api/v1/contacts/merge
        # Merge multiple source contacts into a target contact
        def create
          target_id = params[:target_id]
          source_ids = params[:source_ids]

          if target_id.blank? || source_ids.blank? || !source_ids.is_a?(Array)
            return render json: {
              success: false,
              error: "target_id and source_ids (array) are required"
            }, status: :bad_request
          end

          target_contact = Contact.find(target_id)
          source_contacts = Contact.where(id: source_ids)

          if source_contacts.empty?
            return render json: {
              success: false,
              error: "No source contacts found"
            }, status: :not_found
          end

          ActiveRecord::Base.transaction do
            source_contacts.each do |source|
              merge_contact_into_target(source, target_contact)
            end
          end

          render json: {
            success: true,
            message: "Successfully merged #{source_contacts.count} contact(s) into #{target_contact.display_name}",
            contact: target_contact.as_json
          }
        rescue ActiveRecord::RecordNotFound => e
          render json: {
            success: false,
            error: "Contact not found: #{e.message}"
          }, status: :not_found
        rescue => e
          render json: {
            success: false,
            error: "Failed to merge contacts: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/merge/duplicates
        # Find possible duplicate contacts
        def duplicates
          duplicate_groups = []

          # Find contacts with similar display_name (case insensitive, ignoring extra whitespace)
          contacts_by_name = Contact.all.group_by { |c| normalize_name(c.display_name) }

          contacts_by_name.each do |normalized_name, contacts|
            next if normalized_name.blank?
            next if contacts.size < 2

            duplicate_groups << {
              match_type: "display_name",
              match_value: normalized_name,
              contacts: contacts.map { |c| contact_duplicate_json(c) }
            }
          end

          # Check for first_name + last_name combinations that match
          contacts_by_first_last = Contact.all
            .where.not(first_name: [nil, ""])
            .where.not(last_name: [nil, ""])
            .group_by { |c| "#{normalize_name(c.first_name)}|#{normalize_name(c.last_name)}" }

          contacts_by_first_last.each do |name_key, contacts|
            next if name_key.blank? || name_key == "|"
            next if contacts.size < 2

            # Check if we already have this group from display_name matching
            first_ids = contacts.map(&:id).sort
            already_found = duplicate_groups.any? do |d|
              d[:contacts].map { |c| c[:id] }.sort == first_ids
            end
            next if already_found

            duplicate_groups << {
              match_type: "first_last_name",
              match_value: name_key.gsub("|", " "),
              contacts: contacts.map { |c| contact_duplicate_json(c) }
            }
          end

          # Check for same email (different contacts with same email)
          contacts_by_email = Contact.all
            .where.not(email: [nil, ""])
            .group_by { |c| c.email&.downcase&.strip }

          contacts_by_email.each do |email, contacts|
            next if email.blank?
            next if contacts.size < 2

            email_ids = contacts.map(&:id).sort
            already_found = duplicate_groups.any? do |d|
              d[:contacts].map { |c| c[:id] }.sort == email_ids
            end
            next if already_found

            duplicate_groups << {
              match_type: "email",
              match_value: email,
              contacts: contacts.map { |c| contact_duplicate_json(c) }
            }
          end

          # Sort by number of potential duplicates (most first)
          duplicate_groups.sort_by! { |d| -d[:contacts].size }

          render json: {
            success: true,
            total_duplicate_groups: duplicate_groups.size,
            total_contacts_involved: duplicate_groups.sum { |d| d[:contacts].size },
            duplicates: duplicate_groups
          }
        rescue => e
          Rails.logger.error("Possible duplicates error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to find possible duplicates: #{e.message}"
          }, status: :internal_server_error
        end

        private

        def merge_contact_into_target(source, target_contact)
          # Merge roles
          merged_roles = (target_contact.roles + source.roles).uniq
          target_contact.update(roles: merged_roles)

          # Fill in missing legacy contact information from source if target is missing it
          target_contact.update(email: source.email) if target_contact.email.blank? && source.email.present?
          target_contact.update(mobile_phone: source.mobile_phone) if target_contact.mobile_phone.blank? && source.mobile_phone.present?
          target_contact.update(office_phone: source.office_phone) if target_contact.office_phone.blank? && source.office_phone.present?
          target_contact.update(website: source.website) if target_contact.website.blank? && source.website.present?

          # Merge contact_emails (SSoT)
          merge_contact_emails(source, target_contact)

          # Merge contact_phones (SSoT)
          merge_contact_phones(source, target_contact)

          # Merge contact_addresses (SSoT)
          merge_contact_addresses(source, target_contact)

          # Merge supplier-specific fields
          merge_supplier_fields(source, target_contact)

          # Update foreign keys from source to target
          transfer_foreign_keys(source, target_contact)

          # Transfer Company Group links
          transfer_company_group_links(source, target_contact)

          # Transfer ContactRelationships
          transfer_relationships(source, target_contact)

          # Transfer Xero links
          transfer_xero_links(source, target_contact)

          # Transfer job and case associations
          transfer_associations(source, target_contact)

          # Delete the source contact
          source.destroy
        end

        def merge_contact_emails(source, target_contact)
          source.contact_emails.each do |src_email|
            next if target_contact.contact_emails.exists?(email: src_email.email)
            next if target_contact.email == src_email.email

            has_primary = target_contact.contact_emails.exists?(is_primary: true)
            target_contact.contact_emails.create!(
              email: src_email.email,
              is_primary: src_email.is_primary && !has_primary,
              label: src_email.label,
              position: target_contact.contact_emails.count
            )
          end
        end

        def merge_contact_phones(source, target_contact)
          source.contact_phones.each do |src_phone|
            normalized = src_phone.phone_number.to_s.gsub(/\D/, '')
            existing_phones = target_contact.contact_phones.pluck(:phone_number).map { |p| p.to_s.gsub(/\D/, '') }
            next if existing_phones.include?(normalized)

            has_primary = target_contact.contact_phones.exists?(is_primary: true)
            target_contact.contact_phones.create!(
              phone_number: src_phone.phone_number,
              phone_type: src_phone.phone_type,
              is_primary: src_phone.is_primary && !has_primary,
              label: src_phone.label,
              position: target_contact.contact_phones.count
            )
          end
        end

        def merge_contact_addresses(source, target_contact)
          source.contact_addresses.each do |src_addr|
            next if target_contact.contact_addresses.exists?(address_type: src_addr.address_type)

            has_primary = target_contact.contact_addresses.exists?(is_primary: true)
            target_contact.contact_addresses.create!(
              address_type: src_addr.address_type,
              line1: src_addr.line1,
              line2: src_addr.line2,
              line3: src_addr.line3,
              line4: src_addr.line4,
              city: src_addr.city,
              region: src_addr.region,
              postal_code: src_addr.postal_code,
              country: src_addr.country,
              is_primary: src_addr.is_primary && !has_primary
            )
          end
        end

        def merge_supplier_fields(source, target_contact)
          return unless source.is_supplier? && target_contact.is_supplier?

          # Keep the better rating
          if source.rating.to_i > target_contact.rating.to_i
            target_contact.update(rating: source.rating)
          end

          # Combine notes if both have them
          if source.notes.present? && target_contact.notes.present?
            target_contact.update(notes: "#{target_contact.notes}\n\n--- Merged from contact ##{source.id} ---\n#{source.notes}")
          elsif source.notes.present?
            target_contact.update(notes: source.notes)
          end
        end

        def transfer_foreign_keys(source, target_contact)
          PricebookItem.where(supplier_id: source.id).update_all(supplier_id: target_contact.id)
          PurchaseOrder.where(supplier_id: source.id).update_all(supplier_id: target_contact.id)
          PriceHistory.where(supplier_id: source.id).update_all(supplier_id: target_contact.id)
        end

        def transfer_company_group_links(source, target_contact)
          return unless source.link_to_cg

          if source.linked_company_id.present? && target_contact.linked_company_id.blank?
            Corporate.where(contact_id: source.id).update_all(contact_id: target_contact.id)
            target_contact.update(linked_company_id: source.linked_company_id, link_to_cg: true)
          end

          ContactCompanyGroupMembership.where(contact_id: source.id).each do |membership|
            existing = ContactCompanyGroupMembership.find_by(
              contact_id: target_contact.id,
              company_group_id: membership.company_group_id
            )
            if existing
              existing.update(
                can_view_confidential: existing.can_view_confidential || membership.can_view_confidential,
                can_edit: existing.can_edit || membership.can_edit
              )
              membership.destroy
            else
              membership.update(contact_id: target_contact.id)
            end
          end

          target_contact.update(link_to_cg: true) unless target_contact.link_to_cg
        end

        def transfer_relationships(source, target_contact)
          # Outgoing relationships
          source.outgoing_relationships.each do |relationship|
            existing = target_contact.outgoing_relationships.find_by(
              related_contact_id: relationship.related_contact_id,
              relationship_type: relationship.relationship_type
            )

            if existing
              relationship.destroy
            else
              relationship.update(source_contact_id: target_contact.id)
            end
          end

          # Incoming relationships
          source.incoming_relationships.each do |relationship|
            existing = target_contact.incoming_relationships.find_by(
              source_contact_id: relationship.source_contact_id,
              relationship_type: relationship.relationship_type
            )

            if existing
              relationship.destroy
            else
              relationship.update(related_contact_id: target_contact.id)
            end
          end

          # Transfer primary_company_id
          if source.primary_company_id.present? && target_contact.primary_company_id.blank?
            target_contact.update(primary_company_id: source.primary_company_id)
          end
        end

        def transfer_xero_links(source, target_contact)
          source.xero_links.each do |xero_link|
            existing = target_contact.xero_links.find_by(
              tenant_id: xero_link.tenant_id,
              source: xero_link.source
            )

            if existing
              if xero_link.external_contact_id != existing.external_contact_id
                xero_link.mark_stale!('not_found')
                xero_link.update!(
                  contact_id: target_contact.id,
                  sync_error: "Contact merged - duplicate Xero link marked as stale"
                )
                Rails.logger.info "[ContactMerge] Transferred stale Xero link: #{xero_link.external_contact_id}"
              else
                Rails.logger.info "[ContactMerge] Deleting duplicate Xero link to #{xero_link.tenant_name}"
                xero_link.destroy
              end
            else
              xero_link.update(contact_id: target_contact.id)
              Rails.logger.info "[ContactMerge] Transferred Xero link to #{xero_link.tenant_name}"
            end
          end
        end

        def transfer_associations(source, target_contact)
          # Pre-build lookup sets for performance
          target_job_ids = target_contact.job_contacts.pluck(:job_id).to_set
          target_case_ids = target_contact.case_contacts.pluck(:case_record_id).to_set

          # Transfer job associations
          source.job_contacts.each do |job_contact|
            if target_job_ids.include?(job_contact.job_id)
              job_contact.destroy
            else
              job_contact.update(contact_id: target_contact.id)
            end
          end

          # Transfer case associations
          source.case_contacts.each do |case_contact|
            if target_case_ids.include?(case_contact.case_record_id)
              case_contact.destroy
            else
              case_contact.update(contact_id: target_contact.id)
            end
          end
        end

        def normalize_name(name)
          return nil if name.blank?
          name.to_s.downcase.gsub(/\s+/, " ").strip
        end

        def contact_duplicate_json(contact)
          {
            id: contact.id,
            display_name: contact.display_name,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            entity_type: contact.entity_type,
            roles: contact.roles,
            has_xero: contact.xero_id.present?
          }
        end
      end
    end
  end
end
