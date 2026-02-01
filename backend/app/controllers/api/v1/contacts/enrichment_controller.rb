# frozen_string_literal: true

# SSoT: Enrichment Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - from_bill: POST /api/v1/contacts/enrichment/:contact_id/from_bill
#   - from_web: POST /api/v1/contacts/enrichment/:contact_id/from_web
#   - preview_employees: POST /api/v1/contacts/enrichment/preview_employees
#   - extract_employees: POST /api/v1/contacts/enrichment/extract_employees
#
module Api
  module V1
    module Contacts
      class EnrichmentController < ApplicationController
        before_action :authorize_request
        before_action :set_contact, only: [:from_bill, :from_web]

        # POST /api/v1/contacts/enrichment/:contact_id/from_bill
        # Update contact with fields extracted from a bill/invoice
        def from_bill
          fields = params[:fields]
          bill_id = params[:bill_id]

          # Handle both Hash and ActionController::Parameters
          unless fields.respond_to?(:keys) && fields.keys.any?
            return render json: {
              success: false,
              error: "No fields provided to update"
            }, status: :unprocessable_entity
          end

          # Map extracted field keys to contact attributes
          field_mapping = {
            "supplier_name" => :display_name,
            "abn" => :abn,
            "acn" => :acn,
            "address" => :office_address,
            "city" => :office_city,
            "state" => :office_state,
            "postcode" => :office_postcode,
            "website" => :website,
            "phone" => :office_phone,
            "email" => :office_email
          }

          # Build the attributes to update
          attributes_to_update = {}
          updated_fields = []

          fields.each do |field_key, value|
            contact_attr = field_mapping[field_key.to_s]
            if contact_attr && value.present?
              attributes_to_update[contact_attr] = value
              updated_fields << field_key.to_s
            end
          end

          if attributes_to_update.empty?
            return render json: {
              success: false,
              error: "No valid fields to update"
            }, status: :unprocessable_entity
          end

          ActiveRecord::Base.transaction do
            # Store old values for audit
            old_values = {}
            attributes_to_update.each do |attr, _|
              old_values[attr] = @contact.send(attr)
            end

            # Update the contact
            @contact.update!(attributes_to_update)

            # Create activity log entry
            bill = BillInbox.find_by(id: bill_id)
            invoice_ref = bill ? "##{bill.invoice_number || bill.id}" : "unknown"

            @contact.contact_activities.create!(
              activity_type: "note",
              description: "Updated fields from invoice #{invoice_ref}: #{updated_fields.join(', ')}",
              occurred_at: Time.current,
              metadata: {
                source: "bill_inbox",
                bill_id: bill_id,
                updated_fields: updated_fields,
                old_values: old_values,
                new_values: attributes_to_update
              }
            )
          end

          render json: {
            success: true,
            message: "Contact updated successfully",
            updated_fields: updated_fields,
            contact: @contact.as_json
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: "Failed to update contact: #{e.message}"
          }, status: :unprocessable_entity
        rescue => e
          render json: {
            success: false,
            error: "Failed to update contact: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/enrichment/:contact_id/from_web
        # Enrich contact data from website scraping
        def from_web
          domain = nil

          # First try to extract domain from email
          if @contact.email.present?
            domain = @contact.email.split("@").last.to_s.downcase

            # Check for generic email domains - fall back to website if generic
            generic_domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com"]
            if generic_domains.include?(domain)
              domain = nil # Reset so we try website instead
            end
          end

          # If no domain from email, try to extract from website URL
          if domain.blank? && @contact.website.present?
            begin
              uri = URI.parse(@contact.website)
              domain = uri.host.to_s.downcase.sub(/^www\./, "")
            rescue URI::InvalidURIError
              # Try adding https:// prefix
              begin
                uri = URI.parse("https://#{@contact.website}")
                domain = uri.host.to_s.downcase.sub(/^www\./, "")
              rescue URI::InvalidURIError
                domain = nil
              end
            end
          end

          # If still no domain, we can't enrich
          if domain.blank?
            return render json: {
              success: false,
              error: "Contact has no email address or website to enrich from"
            }, status: :unprocessable_entity
          end

          # FIRST: Check if any existing contacts with this domain already have a company
          # This is faster and prevents duplicate companies
          existing_contact_with_company = Contact.joins(:primary_company, :contact_emails)
                                                 .where("contact_emails.email LIKE ?", "%@#{domain}")
                                                 .where.not(id: @contact.id)
                                                 .includes(:primary_company)
                                                 .first

          if existing_contact_with_company && existing_contact_with_company.primary_company
            # Found existing company for this domain - link to it
            company_contact = existing_contact_with_company.primary_company
            company = Corporate.find_by(contact_id: company_contact.id)

            @contact.update!(primary_company_id: company_contact.id)

            return render json: {
              success: true,
              message: "Contact linked to existing company from domain",
              contact: @contact.as_json(include: :primary_company),
              company_found_from_domain: true,
              company_linked: true,
              found_from_contact: {
                name: existing_contact_with_company.display_name,
                email: existing_contact_with_company.email
              },
              company: {
                id: company&.id,
                name: company_contact.display_name,
                contact_id: company_contact.id
              }
            }, status: :ok
          end

          # No existing company found - proceed with web scraping
          service = EmailToContactExtractionService.new(user: current_user)
          website_details = service.send(:fetch_company_details_from_website, domain)

          if website_details.blank? || website_details.keys.length <= 1
            return render json: {
              success: false,
              error: "No details found on website",
              website: website_details[:website]
            }, status: :not_found
          end

          # Determine if it's a company or sole trader
          has_acn = website_details[:acn].present?
          has_abn = website_details[:abn].present?
          company_name = website_details[:display_name].presence || website_details[:name]

          # Check if company name matches person's name (indicates sole trader)
          is_sole_trader = false
          if company_name.present? && @contact.display_name.present?
            # Simple match: company name contains person's full name or vice versa
            name_match = company_name.downcase.include?(@contact.display_name.downcase) ||
                         @contact.display_name.downcase.include?(company_name.downcase.split.first(2).join(" "))
            is_sole_trader = name_match && !has_acn
          end

          ActiveRecord::Base.transaction do
            # Update contact with website details
            @contact.update!(
              website: website_details[:website],
              office_phone: website_details[:phone] || @contact.office_phone,
              tax_number: website_details[:abn] || @contact.tax_number
            )

            company_created = false
            company_linked = false
            company_info = nil

            if has_acn || (has_abn && !is_sole_trader)
              # It's a company - check if company already exists
              existing_company = Corporate.find_by(abn: website_details[:abn]) if website_details[:abn].present?
              existing_company ||= Corporate.find_by(acn: website_details[:acn]) if website_details[:acn].present?

              if existing_company
                # Link to existing company
                @contact.update!(primary_company_id: existing_company.contact_id)
                company_linked = true
                company_info = {
                  id: existing_company.id,
                  name: existing_company.name,
                  contact_id: existing_company.contact_id
                }
              else
                # Create new company Contact (NOT Corporate)
                # SSoT: Corporate = entities you OWN/MANAGE (SPVs, trusts)
                #       Contact (entity_type='company') = companies you do business WITH
                company_contact = Contact.create!(
                  display_name: company_name,
                  entity_type: "company",
                  is_active: true,
                  created_by: current_user.id,
                  website: website_details[:website],
                  office_phone: website_details[:phone],
                  email: website_details[:email],
                  abn: website_details[:abn],
                  acn: website_details[:acn],
                  address_line1: website_details[:address]
                )

                # Link person to company contact
                @contact.update!(primary_company_id: company_contact.id)

                company_created = true
                company_info = {
                  id: company_contact.id,
                  name: company_name,
                  contact_id: company_contact.id
                }
              end
            end

            render json: {
              success: true,
              message: "Contact enriched from website",
              contact: @contact.as_json(include: :primary_company),
              website_details: website_details,
              is_sole_trader: is_sole_trader,
              company_created: company_created,
              company_linked: company_linked,
              company: company_info
            }, status: :ok
          end
        rescue StandardError => e
          Rails.logger.error("EnrichmentController#from_web error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))

          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/enrichment/preview_employees
        # Preview employee extraction from email patterns
        def preview_employees
          # Parse email patterns - can be array or comma-separated string
          email_patterns = if params[:email_patterns].is_a?(String)
            params[:email_patterns].split(",").map(&:strip).reject(&:blank?)
          else
            Array(params[:email_patterns]).reject(&:blank?)
          end

          # OPTIMIZED: Use database queries to extract unique emails instead of loading all records
          # This prevents memory issues with large email warehouses (20K+ emails would crash the dyno)

          # Track which parent companies each email is associated with
          # Key: email address, Value: Set of parent company info
          email_to_parent_companies = Hash.new { |h, k| h[k] = Set.new }

          # Step 1: Get unique from_email addresses using pluck (memory efficient)
          base_query = SyncedEmail.involving_email(email_patterns)

          from_emails = base_query
            .where.not(from_email: nil)
            .distinct
            .pluck(:from_email)
            .map(&:downcase)
            .uniq

          # Query for unique to_emails (stored as arrays)
          to_emails_raw = base_query
            .where.not(to_emails: nil)
            .pluck(:to_emails)
            .flatten
            .compact
            .map(&:downcase)
            .uniq

          # Query for unique cc_emails (stored as arrays)
          cc_emails_raw = base_query
            .where.not(cc_emails: nil)
            .pluck(:cc_emails)
            .flatten
            .compact
            .map(&:downcase)
            .uniq

          # Combine all unique emails
          all_emails = (from_emails + to_emails_raw + cc_emails_raw).uniq

          # Filter out the search patterns (we don't want to include those)
          patterns_lower = email_patterns.map(&:downcase)
          unique_emails = all_emails.reject { |e| patterns_lower.include?(e) }.to_set

          # Step 2: Determine parent company context (use first pattern's domain)
          first_pattern = email_patterns.first
          if first_pattern
            parent_domain = first_pattern.split("@").last
            parent_company_name = parent_domain.split(".").first.titleize
            parent_company = Contact.find_by(
              "LOWER(display_name) LIKE ? OR LOWER(company_name_or_trust) LIKE ?",
              "%#{parent_company_name.downcase}%",
              "%#{parent_company_name.downcase}%"
            )

            # For parent company relationships, mark direct communicators (from/to, not CC)
            if parent_company
              direct_from = from_emails.to_set
              direct_to = to_emails_raw.to_set

              unique_emails.each do |addr|
                if direct_from.include?(addr) || direct_to.include?(addr)
                  email_to_parent_companies[addr].add({
                    id: parent_company.id,
                    name: parent_company.display_name,
                    entity_type: parent_company.entity_type
                  })
                end
              end
            end
          end

          # Step 3: Build email_bodies lookup for signature extraction
          # Only fetch bodies for the unique senders (not all emails)
          email_bodies = Hash.new { |h, k| h[k] = [] }
          unique_senders = unique_emails & from_emails.to_set

          # Fetch bodies in batches - only need a few emails per sender for signature extraction
          unique_senders.each_slice(50) do |sender_batch|
            # For each sender, get up to 3 recent emails with body_text
            sender_batch.each do |sender|
              bodies = SyncedEmail.where("LOWER(from_email) = ?", sender)
                .where.not(body_text: nil)
                .order(received_at: :desc)
                .limit(3)
                .pluck(:body_text)

              email_bodies[sender] = bodies if bodies.any?
            end
          end

          # Filter out generic/system emails
          generic_patterns = ["noreply", "no-reply", "donotreply", "postmaster", "mailer-daemon", "accounts@", "info@", "support@", "admin@"]
          candidate_emails = unique_emails.reject do |email_addr|
            generic_patterns.any? { |pattern| email_addr.downcase.include?(pattern) }
          end

          # Build preview data for each unique email address
          preview_data = candidate_emails.filter_map do |email_addr|
            build_employee_preview(email_addr, email_to_parent_companies, email_bodies)
          end

          # Filter to only show items where we have matching contacts
          preview_data = preview_data.select { |item| item[:matching_contacts].any? }

          # Filter out "perfect matches" that have nothing to update
          preview_data = filter_complete_matches(preview_data)

          render json: {
            success: true,
            preview: preview_data,
            total_found: preview_data.length,
            emails_searched: base_query.count,
            unique_emails_found: candidate_emails.count
          }
        rescue => e
          Rails.logger.error("Preview employee extraction error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/enrichment/extract_employees
        # Execute employee extraction based on confirmation data
        def extract_employees
          confirmed_extractions = params[:extractions] || []
          relationships_created = 0
          companies_created = 0
          contacts_created = 0
          emails_added = 0
          mobiles_added = 0
          directs_added = 0
          company_phones_added = 0
          contacts_merged = 0

          confirmed_extractions.each do |extraction|
            # Create new contact if requested
            if extraction[:create_new_contact]
              contact = Contact.create!(
                display_name: extraction[:new_contact_name],
                email: extraction[:email],
                mobile_phone: extraction[:mobile],
                entity_type: "person",
                is_active: true
              )
              contacts_created += 1
            else
              # Find the existing contact to update
              contact = Contact.find_by(id: extraction[:contact_id])
              next unless contact
            end

            # Merge duplicate contacts if requested
            if extraction[:merge_contacts] && extraction[:contacts_to_merge].present?
              extraction[:contacts_to_merge].each do |merge_id|
                merge_contact = Contact.find_by(id: merge_id)
                next unless merge_contact

                # Merge the duplicate contact into the primary contact
                merge_contact_into(contact, merge_contact)
                contacts_merged += 1
              end
            end

            # Add email to contact if requested and not already present (skip for new contacts - already set during creation)
            unless extraction[:create_new_contact]
              if extraction[:add_email] && extraction[:email].present?
                if contact.email.blank?
                  contact.update!(email: extraction[:email])
                  emails_added += 1
                elsif contact.email != extraction[:email]
                  Rails.logger.info("Contact #{contact.id} already has email #{contact.email}, not overwriting with #{extraction[:email]}")
                end
              end

              # Add mobile phone to contact if requested and not already present
              if extraction[:add_mobile] && extraction[:mobile].present?
                if contact.mobile_phone.blank?
                  contact.update!(mobile_phone: extraction[:mobile])
                  mobiles_added += 1
                elsif contact.mobile_phone != extraction[:mobile]
                  Rails.logger.info("Contact #{contact.id} already has mobile #{contact.mobile_phone}, not overwriting with #{extraction[:mobile]}")
                end
              end

              # Add direct line to contact if requested and not already present
              if extraction[:add_direct] && extraction[:direct].present?
                if contact.office_phone.blank?
                  contact.update!(office_phone: extraction[:direct])
                  directs_added += 1
                elsif contact.office_phone != extraction[:direct]
                  Rails.logger.info("Contact #{contact.id} already has office_phone #{contact.office_phone}, not overwriting with #{extraction[:direct]}")
                end
              end
            end

            # Add office phone to company if requested
            if extraction[:add_office_to_company] && extraction[:office].present? && extraction[:domain_company_id].present?
              company = Contact.find_by(id: extraction[:domain_company_id])
              if company && company.office_phone.blank?
                company.update!(office_phone: extraction[:office])
                company_phones_added += 1
              end
            end

            # Create relationship to domain company
            if extraction[:link_to_domain_company] && extraction[:domain_company_id]
              company = Contact.find_by(id: extraction[:domain_company_id])

              # Create company if it doesn't exist
              unless company
                company = Contact.create!(
                  display_name: extraction[:domain_company_name],
                  company_name_or_trust: extraction[:domain_company_name],
                  entity_type: "company",
                  is_active: true
                )
                companies_created += 1
              end

              # Create relationship if it doesn't exist
              unless ContactRelationship.exists?(source_contact_id: contact.id, related_contact_id: company.id)
                ContactRelationship.create!(
                  source_contact_id: contact.id,
                  related_contact_id: company.id,
                  relationship_type: "employee_of",
                  is_active: true
                )
                relationships_created += 1
              end
            end

            # Create relationships to parent companies
            (extraction[:parent_company_ids] || []).each do |parent_id|
              next unless parent_id
              parent_company = Contact.find_by(id: parent_id)
              next unless parent_company

              unless ContactRelationship.exists?(source_contact_id: contact.id, related_contact_id: parent_company.id)
                ContactRelationship.create!(
                  source_contact_id: contact.id,
                  related_contact_id: parent_company.id,
                  relationship_type: "employee_of",
                  is_active: true
                )
                relationships_created += 1
              end
            end
          end

          render json: {
            success: true,
            contacts_created: contacts_created,
            relationships_created: relationships_created,
            companies_created: companies_created,
            emails_added: emails_added,
            mobiles_added: mobiles_added,
            directs_added: directs_added,
            company_phones_added: company_phones_added,
            contacts_merged: contacts_merged
          }
        rescue => e
          Rails.logger.error("Extract employees error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: { success: false, error: e.message }, status: :internal_server_error
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

        # Build preview data for a single email address
        def build_employee_preview(email_addr, email_to_parent_companies, email_bodies)
          # Extract person name from email (e.g., "sophie.harder" -> "Sophie Harder")
          email_local = email_addr.split("@").first
          person_name_from_email = email_local.split(/[._-]/).map(&:capitalize).join(" ")

          # Check if this email already exists on any contact
          contact_with_email = Contact.find_by(email: email_addr)

          # Search for potential matching contacts by name match
          matching_contacts = find_matching_contacts_by_name(person_name_from_email)

          # Get email domain company (skip personal email providers)
          domain = email_addr.split("@").last.downcase
          is_personal_domain = personal_email_domain?(domain)

          domain_company = nil
          domain_company_name = nil

          unless is_personal_domain
            domain_company_name = extract_company_name_from_domain(domain)
            domain_company = find_company_by_domain(domain_company_name, matching_contacts)
          end

          # Get parent companies this email was found communicating with
          parent_companies = is_personal_domain ? [] : email_to_parent_companies[email_addr].to_a

          # Filter out the domain company from parent companies to avoid duplication
          if domain_company
            parent_companies = parent_companies.reject { |pc| pc[:id] == domain_company.id }
          end

          # Extract phone numbers from email signatures
          phones = extract_phones_from_signatures(email_bodies[email_addr])

          # Check existing relationships for each potential link
          check_relationship_exists = ->(person_id, company_id) {
            return false unless person_id && company_id
            ContactRelationship.exists?(
              source_contact_id: person_id,
              related_contact_id: company_id,
              relationship_type: "employee_of"
            )
          }

          {
            email: email_addr,
            person_name_from_email: person_name_from_email,
            email_exists_on_contact: contact_with_email.present?,
            existing_contact_with_email: contact_with_email ? {
              id: contact_with_email.id,
              display_name: contact_with_email.display_name,
              entity_type: contact_with_email.entity_type
            } : nil,
            matching_contacts: matching_contacts.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                email: c.email,
                mobile_phone: c.mobile_phone,
                office_phone: c.office_phone,
                entity_type: c.entity_type,
                xero_contact_type: c.xero_contact_types&.first,
                xero_invoice_count: c.xero_invoice_count,
                relationship_to_domain_company_exists: domain_company ? check_relationship_exists.call(c.id, domain_company.id) : false,
                relationships_to_parent_companies: parent_companies.map { |pc|
                  {
                    company_id: pc[:id],
                    company_name: pc[:name],
                    exists: check_relationship_exists.call(c.id, pc[:id])
                  }
                }
              }
            },
            domain_company: build_domain_company_info(domain_company, domain_company_name, is_personal_domain),
            parent_companies: parent_companies.map { |pc|
              parent_contact = Contact.find_by(id: pc[:id])
              {
                id: pc[:id],
                name: pc[:name],
                entity_type: pc[:entity_type],
                office_phone: parent_contact&.office_phone,
                website: parent_contact&.website,
                exists: true
              }
            },
            phones: phones
          }
        end

        def find_matching_contacts_by_name(person_name_from_email)
          name_parts = person_name_from_email.downcase.split(" ")

          if name_parts.length < 2
            Contact.none
          elsif name_parts.any? { |p| p.length == 1 }
            Contact.none
          elsif name_parts.any? { |p| p.length == 2 }
            Contact.none
          else
            Contact.where(entity_type: "person")
              .where(name_parts.map { "LOWER(display_name) ILIKE ?" }.join(" AND "), *name_parts.map { |p| "%#{p}%" })
              .limit(5)
          end
        end

        def personal_email_domain?(domain)
          personal_domain_bases = %w[
            gmail googlemail hotmail outlook live msn
            yahoo ymail icloud me mac
            aol protonmail proton zoho mail inbox
            bigpond optusnet
          ]
          domain_base = domain.split(".").first
          personal_domain_bases.include?(domain_base)
        end

        def extract_company_name_from_domain(domain)
          domain_parts = domain.split(".")
          tlds_and_country_codes = %w[com net org edu gov au uk nz us ca co]
          meaningful_parts = domain_parts.reject { |p| tlds_and_country_codes.include?(p.downcase) || p.length <= 2 }
          (meaningful_parts.first || domain_parts.first).titleize
        end

        def find_company_by_domain(domain_company_name, matching_contacts)
          # Step 1: Try exact-ish match on display_name first
          domain_company = Contact.where(entity_type: ["company", "trust", "sole_trader"])
            .where("LOWER(display_name) LIKE ?", "%#{domain_company_name.downcase}%")
            .first

          # Step 2: If no display_name match, try with spaces removed
          if domain_company.nil?
            domain_company = Contact.where(entity_type: ["company", "trust", "sole_trader"])
              .where("LOWER(REPLACE(display_name, ' ', '')) LIKE ?",
                     "%#{domain_company_name.downcase.gsub(' ', '')}%")
              .first
          end

          # Step 3: Only fall back to company_name_or_trust if no display_name match
          if domain_company.nil?
            domain_company = Contact.where(entity_type: ["company", "trust", "sole_trader"])
              .where("LOWER(company_name_or_trust) LIKE ?", "%#{domain_company_name.downcase}%")
              .first
          end

          # Step 4: Try abbreviation matching
          if domain_company.nil? && domain_company_name.length <= 5
            abbrev = domain_company_name.upcase
            domain_company = Contact.where(entity_type: ["company", "trust", "sole_trader"])
              .where("UPPER(display_name) LIKE ?", "#{abbrev[0..1]}%")
              .first
          end

          # FALLBACK: Check if the matched contact has an existing company relationship
          if domain_company.nil?
            first_match = matching_contacts.first
            if first_match&.primary_company_id
              domain_company = Contact.find_by(id: first_match.primary_company_id)
            end

            if domain_company.nil? && first_match
              employee_rel = ContactRelationship.find_by(
                source_contact_id: first_match.id,
                relationship_type: "employee_of"
              )
              domain_company = Contact.find_by(id: employee_rel&.related_contact_id)
            end
          end

          domain_company
        end

        def build_domain_company_info(domain_company, domain_company_name, is_personal_domain)
          if domain_company
            {
              id: domain_company.id,
              name: domain_company.display_name,
              entity_type: domain_company.entity_type,
              office_phone: domain_company.office_phone,
              website: domain_company.website,
              exists: true
            }
          elsif domain_company_name.present? && !is_personal_domain
            {
              id: nil,
              name: domain_company_name,
              entity_type: "company",
              office_phone: nil,
              website: nil,
              exists: false
            }
          else
            nil
          end
        end

        def filter_complete_matches(preview_data)
          preview_data.reject do |item|
            next false if item[:matching_contacts].length != 1

            contact = item[:matching_contacts].first
            phones = item[:phones] || {}
            domain_company = item[:domain_company]

            email_matches = contact[:email]&.downcase == item[:email].downcase
            employer_linked = contact[:relationship_to_domain_company_exists]

            can_add_mobile = phones[:mobile].present? && contact[:mobile_phone].blank?
            can_add_direct = phones[:direct].present? && contact[:office_phone].blank?
            can_add_office_to_company = phones[:office].present? && domain_company && domain_company[:exists] && domain_company[:office_phone].blank?

            has_something_to_update = can_add_mobile || can_add_direct || can_add_office_to_company || !email_matches || !employer_linked

            !has_something_to_update
          end
        end

        # Extract phone numbers from email signature text
        def extract_phones_from_signatures(bodies)
          return {} if bodies.blank?

          phones = { mobile: nil, office: nil, direct: nil }

          bodies.each do |body|
            next if body.blank?

            signature = extract_signature_from_text(body)
            next if signature.blank?

            # Australian mobile pattern
            mobile_patterns = [
              /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/i,
              /(?:Mobile|Mob|M)[:\s]*(04\d{2}\s?\d{3}\s?\d{3})/i,
              /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{8})/i,
              /(?:Mobile|Mob|M)[:\s]*(04\d{8})/i,
              /(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/,
              /(04\d{2}\s?\d{3}\s?\d{3})/
            ]

            # Office/landline pattern
            office_patterns = [
              /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
              /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
              /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
              /(\+61\s?\d{1}\s?\d{4}\s?\d{4})/,
              /(\(0\d\)\s?\d{4}\s?\d{4})/,
              /(0\d\s?\d{4}\s?\d{4})/
            ]

            # Direct line pattern
            direct_patterns = [
              /(?:Direct|Dir|D)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
              /(?:Direct|Dir|D)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
              /(?:Direct|Dir|D)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
              /(?:Direct|Dir|D)[:\s]*(1800\s?\d{3}\s?\d{3})/i,
              /(?:Direct|Dir|D)[:\s]*(1300\s?\d{3}\s?\d{3})/i
            ]

            # Extract mobile first
            mobile_patterns.each do |pattern|
              match = signature.match(pattern)
              if match && match[1]
                phones[:mobile] ||= normalize_phone_number(match[1])
                break if phones[:mobile]
              end
            end

            # Extract direct BEFORE office
            direct_patterns.each do |pattern|
              match = signature.match(pattern)
              if match && match[1]
                candidate = normalize_phone_number(match[1])
                unless candidate == phones[:mobile]
                  phones[:direct] ||= candidate
                  break if phones[:direct]
                end
              end
            end

            # Extract office last
            office_patterns.each do |pattern|
              match = signature.match(pattern)
              if match && match[1]
                candidate = normalize_phone_number(match[1])
                unless candidate == phones[:mobile] || candidate == phones[:direct]
                  phones[:office] ||= candidate
                  break if phones[:office]
                end
              end
            end

            break if phones[:mobile].present?
          end

          phones.compact
        end

        def extract_signature_from_text(text)
          quote_indicators = [
            /\n[-]+\s*Original Message\s*[-]+/i,
            /\nFrom:\s*[^\n]+\nSent:/i,
            /\nOn\s+.+wrote:/i,
            /\n>+/,
            /\n_{10,}/
          ]

          clean_text = text.dup
          quote_indicators.each do |indicator|
            if (match = clean_text.match(indicator))
              clean_text = clean_text[0...match.begin(0)]
            end
          end

          signature_delimiters = [
            /\n--\s*\n/,
            /\nRegards,?\n/i,
            /\nBest regards,?\n/i,
            /\nThanks,?\n/i,
            /\nCheers,?\n/i,
            /\nKind regards,?\n/i
          ]

          signature_delimiters.each do |delimiter|
            if clean_text.match(delimiter)
              parts = clean_text.split(delimiter, 2)
              if parts.length > 1
                sig_lines = parts[1].split("\n").first(20)
                return sig_lines.join("\n")
              end
            end
          end

          lines = clean_text.split("\n")
          lines.last(15).join("\n")
        end

        def normalize_phone_number(phone)
          return nil if phone.blank?
          clean = phone.gsub(/[^\d+]/, "")
          if clean.start_with?("+61")
            clean = "0" + clean[3..]
          end
          clean
        end

        def merge_contact_into(primary, duplicate)
          return if primary.id == duplicate.id

          Rails.logger.info("Merging contact #{duplicate.id} (#{duplicate.display_name}) into #{primary.id} (#{primary.display_name})")

          # Copy missing legacy contact info from duplicate to primary
          primary.email ||= duplicate.email
          primary.mobile_phone ||= duplicate.mobile_phone
          primary.office_phone ||= duplicate.office_phone
          primary.first_name ||= duplicate.first_name
          primary.last_name ||= duplicate.last_name
          primary.save! if primary.changed?

          # Merge contact_emails (SSoT)
          duplicate.contact_emails.each do |dup_email|
            next if primary.contact_emails.exists?(email: dup_email.email)
            next if primary.email == dup_email.email

            has_primary = primary.contact_emails.exists?(is_primary: true)
            primary.contact_emails.create!(
              email: dup_email.email,
              is_primary: dup_email.is_primary && !has_primary,
              label: dup_email.label,
              position: primary.contact_emails.count
            )
          end

          # Merge contact_phones (SSoT)
          duplicate.contact_phones.each do |dup_phone|
            normalized = dup_phone.phone_number.to_s.gsub(/\D/, '')
            existing_phones = primary.contact_phones.pluck(:phone_number).map { |p| p.to_s.gsub(/\D/, '') }
            next if existing_phones.include?(normalized)

            has_primary = primary.contact_phones.exists?(is_primary: true)
            primary.contact_phones.create!(
              phone_number: dup_phone.phone_number,
              phone_type: dup_phone.phone_type,
              is_primary: dup_phone.is_primary && !has_primary,
              label: dup_phone.label,
              position: primary.contact_phones.count
            )
          end

          # Merge contact_addresses (SSoT)
          duplicate.contact_addresses.each do |dup_addr|
            next if primary.contact_addresses.exists?(address_type: dup_addr.address_type)

            has_primary = primary.contact_addresses.exists?(is_primary: true)
            primary.contact_addresses.create!(
              address_type: dup_addr.address_type,
              line1: dup_addr.line1,
              line2: dup_addr.line2,
              line3: dup_addr.line3,
              line4: dup_addr.line4,
              city: dup_addr.city,
              region: dup_addr.region,
              postal_code: dup_addr.postal_code,
              country: dup_addr.country,
              is_primary: dup_addr.is_primary && !has_primary
            )
          end

          # Move outgoing relationships
          duplicate.outgoing_relationships.each do |rel|
            next if ContactRelationship.exists?(
              source_contact_id: primary.id,
              related_contact_id: rel.related_contact_id
            )
            rel.update!(source_contact_id: primary.id)
          end

          # Move incoming relationships
          duplicate.incoming_relationships.each do |rel|
            next if ContactRelationship.exists?(
              source_contact_id: rel.source_contact_id,
              related_contact_id: primary.id
            )
            rel.update!(related_contact_id: primary.id)
          end

          # Transfer Xero links
          duplicate.xero_links.each do |xero_link|
            existing = primary.xero_links.find_by(
              tenant_id: xero_link.tenant_id,
              source: xero_link.source
            )

            if existing
              if xero_link.external_contact_id != existing.external_contact_id
                xero_link.mark_stale!('not_found')
                xero_link.update!(
                  contact_id: primary.id,
                  sync_error: "Contact merged - duplicate Xero link marked as stale"
                )
                Rails.logger.info("[ContactMerge] Transferred stale Xero link: #{xero_link.external_contact_id}")
              else
                Rails.logger.info("[ContactMerge] Skipping duplicate Xero link to #{xero_link.tenant_name}")
              end
            else
              xero_link.update!(contact_id: primary.id)
              Rails.logger.info("[ContactMerge] Transferred Xero link to #{xero_link.tenant_name}")
            end
          end

          # Soft delete the duplicate contact
          duplicate.update!(is_active: false)

          Rails.logger.info("Merged and deleted duplicate contact #{duplicate.id}")
        end
      end
    end
  end
end
