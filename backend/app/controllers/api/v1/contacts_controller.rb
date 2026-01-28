# frozen_string_literal: true

module Api
  module V1
    class ContactsController < ApplicationController
      before_action :set_contact, only: [:show, :update, :destroy, :activities, :internal_messages, :documents]

      def read_only_fields
        render json: {
          success: true,
          read_only_fields: Contact::XERO_READ_ONLY_FIELDS,
          message: "These fields are synced from Xero and cannot be edited in TEEEM"
        }
      end

      # GET /api/v1/contacts

      def index
        # Show all active contacts by default (unless include_inactive=true)
        @contacts = if params[:include_inactive] == "true"
          Contact.all
        else
          Contact.where(is_active: true)
        end

        # Filter to only show actual company directors
        # Performance: Uses cached column instead of joining corporate_company_directors
        if params[:is_director] == "true"
          @contacts = @contacts.where(is_director_cached: true)
        end

        # Filter to only show family members
        if params[:is_family_member] == "true"
          @contacts = @contacts.where(is_family_member: true)
        end

        # Filter to only show potential directors
        if params[:is_potential_director] == "true"
          @contacts = @contacts.where(is_potential_director: true)
        end

        # Search by name or email (includes company name for team contacts and employer name for employees)
        # SSoT: Supports search_mode parameter (contains, exact, starts_with)
        if params[:search].present?
          search_mode = params[:search_mode] || 'contains'
          search_term = case search_mode
                        when 'exact' then params[:search]
                        when 'starts_with' then "#{params[:search]}%"
                        else "%#{params[:search]}%" # contains (default)
                        end

          # Build WHERE clause based on mode
          # SSoT: Include contact_emails table in search
          ilike_op = search_mode == 'exact' ? '=' : 'ILIKE'
          search_sql = if search_mode == 'exact'
            "LOWER(contacts.display_name) = LOWER(:q) OR
             LOWER(contact_emails.email) = LOWER(:q) OR
             LOWER(contacts.first_name) = LOWER(:q) OR
             LOWER(contacts.last_name) = LOWER(:q) OR
             (contacts.is_team_contact = true AND LOWER(primary_companies_contacts.display_name) = LOWER(:q))"
          else
            "contacts.display_name ILIKE :q OR
             contact_emails.email ILIKE :q OR
             contacts.first_name ILIKE :q OR
             contacts.last_name ILIKE :q OR
             (contacts.is_team_contact = true AND primary_companies_contacts.display_name ILIKE :q)"
          end

          # Find contacts that match the search term directly
          # Note: left_outer_joins(:primary_company) creates alias "primary_companies_contacts"
          # SSoT: Also join contact_emails for email search
          direct_matches = @contacts.left_outer_joins(:primary_company, :contact_emails)
                                    .where(search_sql, q: search_term)
                                    .distinct

          direct_match_ids = direct_matches.pluck(:id)

          # Find companies that match the search term
          company_search_sql = search_mode == 'exact' ? "LOWER(display_name) = LOWER(?)" : "display_name ILIKE ?"
          matching_company_ids = Contact.where(company_search_sql, search_term)
                                       .where(entity_type: %w[company trust sole_trader])
                                       .pluck(:id)

          all_contact_ids = direct_match_ids

          if matching_company_ids.any?
            # Find employees of those companies (via primary_company_id OR via relationships)
            employee_relationship_ids = ContactRelationship
              .active
              .where(relationship_type: "employee_of")
              .where(related_contact_id: matching_company_ids)
              .pluck(:source_contact_id)

            employee_primary_company_ids = Contact.where(primary_company_id: matching_company_ids).pluck(:id)

            employee_ids = (employee_relationship_ids + employee_primary_company_ids).uniq

            # Combine direct matches with employees of matching companies
            all_contact_ids = (direct_match_ids + matching_company_ids + employee_ids).uniq
          end

          # EXPANDED SEARCH: When include_jobs=true, also find other contacts on same jobs
          # This allows "search pam" to also show other clients/employees on Pam's jobs
          # Only expand from contacts that have emails (otherwise we expand from contacts
          # that won't even show in results due to with_email filter)
          if params[:include_jobs] == "true" && direct_match_ids.any?
            # Get job IDs for matching contacts (only those with emails)
            matching_contacts_with_email = Contact.where(id: direct_match_ids).with_email.pluck(:id)
            job_ids_from_matches = JobContact.where(contact_id: matching_contacts_with_email).pluck(:job_id).uniq

            if job_ids_from_matches.any?
              # Find all other contacts on those same jobs (colleagues)
              job_colleague_ids = JobContact.where(job_id: job_ids_from_matches)
                                            .where.not(contact_id: direct_match_ids)
                                            .pluck(:contact_id)
                                            .uniq

              # Store which jobs each colleague is related to (for display)
              @colleague_job_map = {}
              if job_colleague_ids.any?
                JobContact.where(contact_id: job_colleague_ids, job_id: job_ids_from_matches)
                          .includes(:job)
                          .each do |jc|
                  @colleague_job_map[jc.contact_id] ||= []
                  @colleague_job_map[jc.contact_id] << {
                    id: jc.job_id,
                    name: jc.job&.name,
                    location: jc.job&.location
                  }
                end
              end

              all_contact_ids = (all_contact_ids + job_colleague_ids).uniq
            end

            # Also find other contacts in the same companies
            # Only expand from contacts that have emails (otherwise we expand from contacts
            # that won't even show in results due to with_email filter)
            primary_company_ids_from_matches = Contact.where(id: direct_match_ids)
                                                      .where.not(primary_company_id: nil)
                                                      .with_email  # Only expand from contacts with emails
                                                      .pluck(:primary_company_id)
                                                      .uniq

            if primary_company_ids_from_matches.any?
              # Find other employees of those same companies
              company_colleague_ids = Contact.where(primary_company_id: primary_company_ids_from_matches)
                                             .where.not(id: direct_match_ids)
                                             .where(is_active: true)
                                             .pluck(:id)

              all_contact_ids = (all_contact_ids + company_colleague_ids).uniq

              # Also include the company contacts themselves (the company's own email)
              # e.g., when Dan Ryan matches, also include "Davidson Ryan Lawyers" company contact
              company_contact_ids = Contact.where(id: primary_company_ids_from_matches)
                                           .with_email
                                           .where(is_active: true)
                                           .where.not(id: direct_match_ids)
                                           .pluck(:id)
              all_contact_ids = (all_contact_ids + company_contact_ids).uniq
            end
          end

          @contacts = @contacts.where(id: all_contact_ids)
        end

        # Filter by role (updated from deprecated contact_types to roles)
        if params[:role].present?
          @contacts = @contacts.with_role(params[:role])
        end

        # Filter by contact type (supplier/customer)
        # Performance: Uses cached boolean columns (is_supplier_cached, is_customer_cached)
        # instead of expensive JOINs that caused cartesian products
        if params[:type].present? && params[:role].blank?
          case params[:type]
          when "suppliers"
            # Suppliers: contacts with is_supplier_cached=true
            # Cached column is updated when contacts get POs, pricebooks, price histories, or bills
            #
            # Company-aware supplier search: When searching, also find supplier COMPANIES
            # where an EMPLOYEE matches the search term (e.g., search "troy" finds "Pre Hung Doors"
            # if Troy Wilson works there and Pre Hung Doors is a supplier)
            # The matched employee names are returned in `matched_employees` for UI display
            #
            # NOTE: For simpler search scenarios without employee match tracking, use:
            #   Contact.search_by_relevance(term, suppliers_only: true, include_employee_matches: true)
            # This controller has extended logic for UI display of matched employee names.
            if params[:search].present?
              search_term = "%#{params[:search]}%"

              # Find people (employees) matching the search term
              # Note: Must include is_team_contact because display_name method depends on it
              matching_employees = Contact.where(entity_type: "person")
                                          .where("display_name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?",
                                                 search_term, search_term, search_term)
                                          .select(:id, :display_name, :primary_company_id, :is_team_contact)

              # Build mapping: employer_id -> [employee names]
              @matched_employees_by_company = {}
              matching_employees.each do |emp|
                next unless emp.primary_company_id
                @matched_employees_by_company[emp.primary_company_id] ||= []
                @matched_employees_by_company[emp.primary_company_id] << emp.display_name
              end

              # Also check ContactRelationship employee_of
              if matching_employees.any?
                employee_relationships = ContactRelationship
                  .active
                  .where(relationship_type: "employee_of")
                  .where(source_contact_id: matching_employees.map(&:id))
                  .pluck(:source_contact_id, :related_contact_id)

                employee_names_by_id = matching_employees.index_by(&:id)
                employee_relationships.each do |emp_id, company_id|
                  emp = employee_names_by_id[emp_id]
                  next unless emp
                  @matched_employees_by_company[company_id] ||= []
                  @matched_employees_by_company[company_id] << emp.display_name unless @matched_employees_by_company[company_id].include?(emp.display_name)
                end
              end

              employer_company_ids = @matched_employees_by_company.keys

              # Include ALL employer companies of matching employees (regardless of is_supplier_cached)
              # This allows finding potential suppliers by employee name before they're officially marked
              valid_employer_ids = employer_company_ids.any? ?
                Contact.where(id: employer_company_ids, is_active: true).pluck(:id) : []

              # Build final result:
              # 1. Direct supplier matches (name matches + is_supplier_cached=true)
              # 2. Direct name matches (company name matches, regardless of is_supplier_cached)
              #    This is critical: allows finding "Dam Plasterboard" even before first PO
              # 3. Employer companies of matching employees (potential suppliers via employee)
              #
              # Exclude employees (people with primary_company_id) - show their company instead
              direct_supplier_ids = @contacts.where(is_supplier_cached: true)
                                             .where("contacts.entity_type IN ('company', 'trust') OR contacts.primary_company_id IS NULL")
                                             .pluck(:id)

              # Include ALL companies whose name matches the search term (potential suppliers by company name)
              # This ensures "Dam Plasterboard" appears in results even with is_supplier_cached=false
              direct_name_match_ids = @contacts.where("contacts.entity_type IN ('company', 'trust') OR contacts.primary_company_id IS NULL")
                                               .pluck(:id)

              all_supplier_ids = (direct_supplier_ids + direct_name_match_ids + valid_employer_ids).uniq
              @contacts = Contact.where(id: all_supplier_ids).where(is_active: true)

              # Store search term for relevance-based ordering
              @supplier_search_term = params[:search]
            else
              # No search term - show all suppliers (excluding employees who have employer companies)
              @contacts = @contacts.where(is_supplier_cached: true)
                                   .where("contacts.entity_type IN ('company', 'trust') OR contacts.primary_company_id IS NULL")
            end
          when "customers"
            # Customers: contacts with is_customer_cached=true
            # Cached column is updated when contacts get jobs
            @contacts = @contacts.where(is_customer_cached: true)
          when "both"
            # All contacts (no filter)
          end
        end

        # Filter suppliers by pricebook items they supply (have price histories for)
        # Use: ?type=suppliers&for_pricebook_items=1,2,3
        if params[:for_pricebook_items].present? && params[:type] == "suppliers"
          pricebook_item_ids = params[:for_pricebook_items].to_s.split(",").map(&:to_i).reject(&:zero?)
          if pricebook_item_ids.any?
            supplier_ids_for_items = PriceHistory
              .where(pricebook_item_id: pricebook_item_ids)
              .where.not(supplier_id: nil)
              .distinct
              .pluck(:supplier_id)
            @contacts = @contacts.where(id: supplier_ids_for_items)
          end
        end

        # Filter by Xero sync status (SSoT: contact_external_links)
        if params[:xero_sync].present?
          case params[:xero_sync]
          when "synced"
            @contacts = @contacts.joins(:external_links).where(contact_external_links: { source: "xero" }).distinct
          when "not_synced"
            @contacts = @contacts.where.not(id: ContactExternalLink.xero.select(:contact_id))
          end
        end

        # Filter contacts linked to a specific Xero tenant (SSoT: ContactExternalLink.tenant_id)
        if params[:xero_tenant_id].present?
          @contacts = @contacts.joins(:external_links)
                               .where(contact_external_links: { source: "xero", tenant_id: params[:xero_tenant_id] })
                               .distinct
        end

        # Filter to only show possible duplicate contacts
        if params[:duplicates_only] == "true"
          # Find contacts that share a normalized display_name with at least one other contact
          duplicate_ids = find_duplicate_contact_ids
          @contacts = @contacts.where(id: duplicate_ids)
        end

        # Filter by having contact info
        @contacts = @contacts.with_email if params[:with_email] == "true"
        @contacts = @contacts.with_phone if params[:with_phone] == "true"

        # Filter by entity type (person, company, trust) - supports comma-separated values
        if params[:entity_type].present?
          entity_types = params[:entity_type].to_s.split(",").map(&:strip)
          @contacts = @contacts.where(entity_type: entity_types)
        end

        # Filter to exclude contacts already in corporate (have company_group_id)
        if params[:not_corporate] == "true"
          @contacts = @contacts.where(company_group_id: nil)
        end

        # Fix PostgreSQL DISTINCT + ORDER BY conflict:
        # When DISTINCT is used earlier in the query chain (from joins, .distinct calls, or .or()),
        # PostgreSQL requires ORDER BY columns to be in SELECT list.
        # Solution: Resolve DISTINCT via subquery, then order the final results.
        if @contacts.distinct_value || @contacts.to_sql.include?("DISTINCT")
          contact_ids = @contacts.pluck(:id)
          @contacts = Contact.where(id: contact_ids)
        end

        # Relevance-based ordering for supplier search:
        # Prioritize prefix matches over contains matches, and suppliers over non-suppliers
        # This ensures "Dam Plasterboard" appears before "Adam" when searching "dam"
        if @supplier_search_term.present?
          prefix_term = "#{@supplier_search_term}%"      # Starts with
          contains_term = "%#{@supplier_search_term}%"   # Contains anywhere
          # Order by:
          # 1. Prefix match + is_supplier (name STARTS with search term and is supplier) → highest
          # 2. Prefix match (name STARTS with search term) → high
          # 3. Contains match + is_supplier (name CONTAINS search term and is supplier) → medium
          # 4. Contains match (name CONTAINS search term) → lower
          # 5. Everything else (employee-derived matches) → lowest
          # 6. Alphabetical within each group
          @contacts = @contacts.order(
            Arel.sql(Contact.sanitize_sql_array([
              "CASE
                WHEN display_name ILIKE ? AND is_supplier_cached = true THEN 1
                WHEN display_name ILIKE ? THEN 2
                WHEN display_name ILIKE ? AND is_supplier_cached = true THEN 3
                WHEN display_name ILIKE ? THEN 4
                ELSE 5
              END, display_name ASC",
              prefix_term, prefix_term, contains_term, contains_term
            ]))
          )
        else
          @contacts = @contacts.order(:display_name)
        end

        # Optionally include companies and jobs data
        include_companies = params[:include_companies] == "true"
        include_jobs = params[:include_jobs] == "true"

        # Include director details if filtering for directors
        director_fields = params[:is_director] == "true" ? [ :place_of_birth, :birth_state, :birth_country, :residential_address ] : []

        # Performance: Eager load associations to avoid N+1 queries
        # portal_user and corporate_groups_via_membership are always included in as_json response
        # FRC (Jan 2026): Fixed from :corporate_group (doesn't exist) to :corporate_groups_via_membership (has_many through)
        # contact_emails needed for email method (used by email composer autocomplete)
        @contacts = @contacts.includes(:portal_user, :corporate_groups_via_membership, :contact_emails)

        # Conditional eager loading for company relationships
        if include_companies
          @contacts = @contacts.includes(:primary_company, outgoing_relationships: :related_contact)
        end

        # Performance: Pre-compute expensive boolean flags via SQL (avoids N+1)
        # These replace the expensive method calls that were causing ~1,130 queries per request
        contact_ids = @contacts.map(&:id)
        precomputed_flags = precompute_contact_flags(contact_ids)

        # PERFORMANCE: Pre-compute company_group_memberships_count (avoids N+1)
        # P95 was 5.07s due to N+1 COUNT queries; should be <500ms with batch query
        membership_counts = ContactCorporateGroupMembership
          .where(contact_id: contact_ids)
          .group(:contact_id)
          .count

        # Note: Removed is_customer?, is_supplier?, is_director?, company_group_memberships_count from methods
        # These are pre-computed above to avoid N+1 queries
        #
        # Include contact_emails when with_email=true (for email compose autocomplete)
        # This allows frontend to show/select from multiple emails per contact
        include_all_emails = params[:with_email] == "true"

        json_includes = {
          portal_user: {},
          corporate_groups_via_membership: {}
        }

        if include_all_emails
          json_includes[:contact_emails] = { only: [ :id, :email, :is_primary, :label ] }
        end

        contacts_json = @contacts.as_json(
          include: json_includes,
          methods: [ :is_sales?, :is_land_agent?, :display_name, :xero_linked_count, :xero_customer?, :xero_supplier?, :email ]
        )

        # Performance: Build hash map for O(1) lookups instead of O(n²) array search
        contacts_by_id = @contacts.index_by(&:id)

        # Performance: Pre-fetch employer names for person contacts (company-aware search display)
        # This allows frontend to show "Troy Smith - Harvey Norman" format
        employer_names = Contact.where(id: @contacts.where.not(primary_company_id: nil).pluck(:primary_company_id))
                                .pluck(:id, :display_name)
                                .to_h

        # Merge pre-computed flags and counts into JSON
        contacts_json.each do |contact_json|
          flags = precomputed_flags[contact_json["id"]] || {}
          contact_json["is_customer?"] = flags[:is_customer] || false
          contact_json["is_supplier?"] = flags[:is_supplier] || false
          contact_json["is_director?"] = flags[:is_director] || false
          contact_json["company_group_memberships_count"] = membership_counts[contact_json["id"]] || 0

          # Add employer_name for person contacts (company-aware search)
          # SSoT: primary_company_id links person to their employer
          primary_company_id = contacts_by_id[contact_json["id"]]&.primary_company_id
          if primary_company_id
            contact_json["employer_name"] = employer_names[primary_company_id]
          end

          # Add matched_employees for company contacts (supplier search by employee name)
          # Shows which employees matched the search term (e.g., "Troy Wilson" when searching "troy")
          if @matched_employees_by_company && @matched_employees_by_company[contact_json["id"]]
            contact_json["matched_employees"] = @matched_employees_by_company[contact_json["id"]]
          end
        end

        # Add company and job counts for all contacts
        if include_companies || include_jobs
          contact_ids = @contacts.map(&:id)

          # Performance: Pre-fetch job counts with GROUP BY (avoids N+1)
          job_counts_by_contact = if include_jobs
            JobContact.where(contact_id: contact_ids)
                      .group(:contact_id)
                      .count
          else
            {}
          end

          # Performance: Pre-fetch ALL jobs for each contact (for email compose display)
          # Returns array of jobs per contact, showing location/address for context
          jobs_by_contact = {}
          if include_jobs
            job_contacts = JobContact
              .where(contact_id: contact_ids)
              .includes(job: :job_status)
              .joins(:job)
              .order("jobs.created_at DESC")

            # Group all jobs by contact_id
            job_contacts.each do |jc|
              jobs_by_contact[jc.contact_id] ||= []
              jobs_by_contact[jc.contact_id] << {
                id: jc.job.id,
                name: jc.job.name,
                job_code: jc.job.job_code,
                location: jc.job.location,
                role: jc.role
              }
            end
          end

          contacts_json.each do |contact_json|
            contact = contacts_by_id[contact_json["id"]]
            next unless contact

            if include_companies
              # Add primary company info
              if contact.primary_company
                contact_json["primary_company"] = {
                  id: contact.primary_company.id,
                  name: contact.primary_company.display_name
                }
              end

              # Get all company relationships with roles
              company_relationships = contact.outgoing_relationships
                .active
                .where(relationship_type: [ "director_of", "shareholder_of", "trustee_of", "employee_of", "partner_in", "authorized_signatory_of", "beneficial_owner_of" ])
                .includes(:related_contact)

              contact_json["additional_companies_count"] = company_relationships.count

              # Include company_roles for display (e.g., "Director @ Harvey Norman")
              contact_json["company_roles"] = company_relationships.filter_map do |rel|
                next unless rel.related_contact
                {
                  company_id: rel.related_contact_id,
                  company_name: rel.related_contact.display_name,
                  role: rel.relationship_type.gsub("_of", "").gsub("_", " ").titleize
                }
              end
            end

            if include_jobs
              # Use pre-fetched count (avoids N+1)
              contact_json["jobs_count"] = job_counts_by_contact[contact.id] || 0

              # Include ALL jobs for this contact (for email compose job linking)
              if jobs_by_contact[contact.id]
                contact_json["jobs"] = jobs_by_contact[contact.id]
              end

              # Mark contacts found via job colleague expansion (for UI display)
              # These are contacts who share a job with the original search match
              if @colleague_job_map && @colleague_job_map[contact.id]
                contact_json["found_via_job"] = true
                contact_json["related_jobs"] = @colleague_job_map[contact.id]
              end
            end
          end
        end

        # Add employee names and payment terms for supplier contacts
        # Also include for entity_type queries that include companies (for PO supplier selection)
        entity_types = params[:entity_type].to_s.split(",").map(&:strip)
        is_company_query = entity_types.intersect?(%w[company trust sole_trader])
        if params[:type] == "suppliers" || (params[:entity_type].present? && is_company_query)
          supplier_ids = @contacts.map(&:id)

          # Performance: Pre-fetch employee counts and names with GROUP BY (avoids N+1)
          if params[:include_employees] != "false"
            # Get employee counts by company
            employee_counts = Contact.where(primary_company_id: supplier_ids)
                                     .where(is_active: true)
                                     .group(:primary_company_id)
                                     .count

            # Get top 10 employee names per company (using window function for efficiency)
            # First get all active employees with their company, then group in Ruby
            all_employees = Contact.where(primary_company_id: supplier_ids)
                                   .where(is_active: true)
                                   .order(:display_name)
                                   .pluck(:primary_company_id, :display_name)
            employee_names_by_company = all_employees.group_by(&:first)
                                                     .transform_values { |v| v.first(10).map(&:last).compact }
          else
            employee_counts = {}
            employee_names_by_company = {}
          end

          contacts_json.each do |contact_json|
            contact = contacts_by_id[contact_json["id"]]
            next unless contact

            # Payment terms (for auto-calculating PO due date)
            contact_json["bill_due_day"] = contact.bill_due_day
            contact_json["bill_due_type"] = contact.bill_due_type
            contact_json["payment_terms"] = contact.payment_terms

            # Use pre-fetched employee data (avoids N+1)
            if params[:include_employees] != "false"
              contact_json["employee_names"] = employee_names_by_company[contact.id] || []
              contact_json["employee_count"] = employee_counts[contact.id] || 0
            end
          end
        end

        # Add which pricebook items each supplier has price histories for
        # This helps the frontend show which items aren't covered by a supplier
        if params[:for_pricebook_items].present? && params[:type] == "suppliers"
          pricebook_item_ids = params[:for_pricebook_items].to_s.split(",").map(&:to_i).reject(&:zero?)
          if pricebook_item_ids.any?
            # Get supplier -> item mappings
            supplier_items = PriceHistory
              .where(pricebook_item_id: pricebook_item_ids)
              .where.not(supplier_id: nil)
              .group(:supplier_id)
              .pluck(:supplier_id, Arel.sql("array_agg(DISTINCT pricebook_item_id)"))
              .to_h

            contacts_json.each do |contact_json|
              contact_json["supplied_pricebook_item_ids"] = supplier_items[contact_json["id"]] || []
            end
          end
        end

        render json: {
          success: true,
          contacts: contacts_json
        }
      end

      # GET /api/v1/contacts/:id

      def show
        # If this contact is a supplier, include their supplier-specific data
        contact_json = @contact.as_json(
          include: {
            contact_emails: {},
            contact_phones: {},
            contact_persons: {},
            contact_addresses: {},
            contact_groups: {},
            portal_user: {}
          },
          methods: [ :is_customer?, :is_supplier?, :is_sales?, :is_land_agent?, :is_director?, :director_companies, :display_name ]
        )

        # If contact is a supplier, add pricebook items and purchase orders
        if @contact.is_supplier?
          # Get items where this contact is the supplier OR default_supplier OR has provided a quote (in price_histories)
          # Optimized to use a single query with LEFT JOIN instead of 3 separate queries
          # Note: PricebookItem uses table_name = 'pricebooks'
          all_items = PricebookItem
            .left_joins(:price_histories)
            .where(
              "pricebooks.supplier_id = ? OR pricebooks.default_supplier_id = ? OR price_histories.supplier_id = ?",
              @contact.id, @contact.id, @contact.id
            )
            .includes(:price_histories)
            .distinct
            .order(:item_code)

          contact_json[:pricebook_items_count] = all_items.size # Use size instead of count to avoid extra query
          contact_json[:purchase_orders_count] = @contact.purchase_orders.count

          # Build items with price histories specific to this contact
          contact_json[:pricebook_items] = all_items.map do |item|
            # Filter preloaded price histories for this contact (no N+1)
            price_histories = item.price_histories
              .select { |ph| ph.supplier_id == @contact.id }
              .sort_by { |ph| [ (ph.date_effective || Time.at(0)).to_time, (ph.created_at || Time.at(0)).to_time ] }
              .reverse
              .map do |ph|
                ph.as_json
              end

            item.as_json.merge(
              is_default_supplier: item.default_supplier_id == @contact.id,
              price_histories: price_histories
            )
          end
        end

        # Add primary company and employment details
        if @contact.primary_company.present?
          company = @contact.primary_company
          company_record = CorporateCompany.find_by(contact_id: company.id)

          contact_json[:primary_company] = {
            id: company.id,
            name: company.display_name,
            email: company.email,
            website: company.website,
            address: company.address,
            roles: company.roles,
            # Include ABN/ACN if company record exists
            abn: company_record&.abn,
            acn: company_record&.acn,
            # Include company contact details
            contact_emails: company.contact_emails.ordered.map { |e|
              { id: e.id, email: e.email, is_primary: e.is_primary, label: e.label, position: e.position }
            },
            contact_phones: company.contact_phones.ordered.map { |p|
              { id: p.id, phone_number: p.phone_number, phone_type: p.phone_type, is_primary: p.is_primary, label: p.label, position: p.position }
            }
          }
        end

        # Add employees for company contacts (using BOTH old and new systems)
        if @contact.entity_type == "company" || @contact.entity_type == "trust"
          # Get employees from NEW ContactRelationship system (with display_order)
          employee_relationships = @contact.incoming_relationships
            .active
            .where(relationship_type: "employee_of")
            .order(:display_order, :created_at)  # Sort by display_order first, then created_at
            .includes(:source_contact)

          employees_from_relationships = employee_relationships
            .map { |rel| rel.source_contact }
            .compact

          # Create a map of employee_id => display_order for later use
          employee_display_order = employee_relationships.each_with_object({}) do |rel, hash|
            hash[rel.source_contact_id] = rel.display_order if rel.source_contact
          end

          # Get employees from OLD primary_company_id system (for backwards compatibility)
          employees_from_primary = Contact
            .where(primary_company_id: @contact.id)
            .where(entity_type: "person")
            .where.not(id: employees_from_relationships.map(&:id))  # Exclude duplicates

          # Combine both sources (relationships already sorted, primary at end)
          all_employees = employees_from_relationships + employees_from_primary

          contact_json[:employees] = all_employees.map.with_index do |employee, index|
            {
              id: employee.id,
              display_name: employee.display_name,
              first_name: employee.first_name,
              last_name: employee.last_name,
              email: employee.email,
              mobile_phone: employee.mobile_phone,
              display_order: employee_display_order[employee.id] || index,  # Use stored order or position
              is_primary: index == 0  # First employee is primary
            }
          end
        end

        # Add additional companies via relationships
        contact_json[:additional_companies] = @contact.outgoing_relationships
          .active
          .where(relationship_type: [ "director_of", "shareholder_of", "trustee_of", "employee_of", "partner_in", "authorized_signatory_of", "beneficial_owner_of" ])
          .includes(:related_contact)
          .filter_map do |rel|
            # Skip orphaned relationships where related_contact no longer exists
            next unless rel.related_contact

            {
              id: rel.related_contact.id,
              name: rel.related_contact.display_name,
              entity_type: rel.related_contact.entity_type,
              relationship_type: rel.relationship_type,
              role_in_relationship: rel.role_in_relationship,
              ownership_percentage: rel.ownership_percentage,
              context: rel.context,
              start_date: rel.start_date,
              end_date: rel.end_date,
              is_active: rel.is_active
            }
          end

        # Add jobs/constructions
        contact_json[:jobs] = @contact.job_contacts
          .includes(job: [ :job_status, :job_stage ])
          .map do |jc|
            {
              job_id: jc.job_id,
              job_title: jc.job.name,
              location: jc.job.location,
              role: jc.role,
              primary: jc.primary,
              status: jc.job.job_status&.name,
              stage: jc.job.job_stage&.name
            }
          end

        # SSoT: If this contact is linked to a Company, include company data
        linked_company = CorporateCompany.find_by(contact_id: @contact.id)
        if linked_company
          linked_company_data = {
            id: linked_company.id,
            name: linked_company.name,
            acn: linked_company.acn,
            abn: linked_company.abn,
            status: linked_company.status,
            entity_type: linked_company.entity_type,
            is_trustee: linked_company.is_trustee,
            trust_name: linked_company.trust_name,
            date_incorporated: linked_company.date_incorporated,
            registered_office_address: linked_company.registered_office_address,
            principal_place_of_business: linked_company.principal_place_of_business,
            company_group_id: linked_company.company_group_id,
            company_group_name: linked_company.corporate_group&.name
          }

          # SSoT: Only include corporate data (directors, shareholdings) if user has permission
          if can_view_corporate?
            linked_company_data[:directors] = linked_company.corporate_company_directors.includes(:contact).map do |d|
              {
                id: d.id,
                contact_id: d.contact_id,
                contact_name: d.contact&.display_name,
                position: d.position,
                formatted_position: d.formatted_position,
                appointment_date: d.appointment_date,
                resignation_date: d.resignation_date,
                is_current: d.is_current
              }
            end
            linked_company_data[:shareholdings] = linked_company.corporate_company_shareholdings.includes(:shareholder).map do |s|
              {
                id: s.id,
                shareholder_type: s.shareholder_type,
                shareholder_id: s.shareholder_id,
                shareholder_name: s.shareholder&.respond_to?(:name) ? s.shareholder.name : s.shareholder&.display_name,
                share_class: s.share_class,
                number_of_shares: s.number_of_shares,
                beneficially_held: s.beneficially_held,
                date_acquired: s.acquisition_date
              }
            end
            linked_company_data[:directors_count] = linked_company.corporate_company_directors.current.count
            linked_company_data[:shareholdings_count] = linked_company.corporate_company_shareholdings.count
            linked_company_data[:documents_count] = linked_company.corporate_company_documents.count
            # SSoT: Include bank accounts from the bank_accounts table
            linked_company_data[:bank_accounts] = linked_company.bank_accounts.active.map do |ba|
              {
                id: ba.id,
                institution_name: ba.institution_name,
                bsb: ba.bsb,
                account_number: ba.account_number,
                account_name: ba.account_name,
                bank_code: ba.bank_code,
                xero_account_id: ba.xero_account_id,
                status: ba.status,
                display_name: ba.display_name,
                formatted_bsb: ba.formatted_bsb,
                linked_to_xero: ba.linked_to_xero?
              }
            end
            linked_company_data[:bank_accounts_count] = linked_company.bank_accounts.active.count
          else
            # For users without corporate permission, hide corporate data
            linked_company_data[:directors] = []
            linked_company_data[:shareholdings] = []
            linked_company_data[:directors_count] = 0
            linked_company_data[:shareholdings_count] = 0
            linked_company_data[:documents_count] = 0
            linked_company_data[:bank_accounts] = []
            linked_company_data[:bank_accounts_count] = 0
          end

          contact_json[:linked_company] = linked_company_data
        end

        # SSoT: Add Xero link summary (derived from contact_external_links)
        contact_json[:xero_link_summary] = @contact.xero_link_summary
        contact_json[:xero_linked_count] = @contact.xero_linked_count
        contact_json[:xero_tenant_names] = @contact.xero_tenant_names
        contact_json[:xero_customer] = @contact.xero_customer?
        contact_json[:xero_supplier] = @contact.xero_supplier?

        # SSoT: Filter confidential fields based on user permissions
        contact_json = filter_confidential_fields(contact_json)

        # Add permission indicators for frontend
        contact_json[:can_view_confidential] = current_user&.can_view_confidential? || false
        contact_json[:can_view_corporate] = can_view_corporate? || false
        contact_json[:can_edit_corporate] = can_edit_corporate? || false
        contact_json[:can_view_cases] = can_view_cases? || false

        render json: {
          success: true,
          contact: contact_json
        }
      end

      # POST /api/v1/contacts

      def create
        Rails.logger.info "[ContactCreate] Received params: #{contact_params.inspect}"

        @contact = Contact.new(contact_params)

        Rails.logger.info "[ContactCreate] Contact built, valid? #{@contact.valid?}"
        Rails.logger.info "[ContactCreate] Validation errors: #{@contact.errors.full_messages}" unless @contact.valid?

        if @contact.save
          Rails.logger.info "[ContactCreate] Contact saved successfully: #{@contact.id}"
          render json: { success: true, contact: @contact }, status: :created
        else
          Rails.logger.error "[ContactCreate] Save failed: #{@contact.errors.full_messages.join(', ')}"
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error "[ContactCreate] Exception: #{e.class.name} - #{e.message}"
        Rails.logger.error e.backtrace.first(10).join("\n")
        render json: { success: false, error: "#{e.class.name}: #{e.message}" }, status: :internal_server_error
      end

      # PATCH /api/v1/contacts/:id

      def update
        # Handle contact groups separately
        if params[:contact][:contact_group_ids] || params[:contact][:new_contact_group_names]
          handle_contact_groups
        end

        if @contact.update(contact_params.except(:contact_group_ids, :new_contact_group_names))
          # Reload to ensure associations are fresh after nested attribute updates
          @contact.reload
          render json: {
            success: true,
            contact: @contact.as_json(
              include: {
                contact_emails: {},
                contact_phones: {},
                contact_addresses: {},
                contact_persons: {},
                contact_groups: {}
              },
              methods: [ :is_employee?, :is_sales?, :is_land_agent?, :display_name ]
            )
          }
        else
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:id

      def destroy
        # Comprehensive safety checks before deletion

        # BLOCKER: Check for linked User account (this person can login!)
        if @contact.user.present?
          return render json: {
            success: false,
            error: "Cannot delete contact with linked user account.",
            reason: "has_user_account",
            details: {
              user_id: @contact.user.id,
              user_email: @contact.user.email,
              message: "This contact has a linked user account (#{@contact.user.email}) that can login to the system. " \
                       "To remove this contact: either archive it (data preserved), or delete the user account first."
            },
            can_archive: true
          }, status: :unprocessable_entity
        end

        # Check for Company Group links (SSoT protection)
        if @contact.link_to_cg
          if @contact.linked_company_id.present?
            # This contact is linked to a Company record
            company = CorporateCompany.find_by(id: @contact.linked_company_id)
            return render json: {
              success: false,
              error: "Cannot delete contact linked to Company '#{company&.name || 'Unknown'}'. Unlink from Company Group first.",
              reason: "linked_to_company",
              linked_company_id: @contact.linked_company_id
            }, status: :unprocessable_entity
          else
            # This is a person with Company Group memberships
            membership_count = ContactCorporateGroupMembership.where(contact_id: @contact.id).count
            if membership_count > 0
              return render json: {
                success: false,
                error: "Cannot delete contact with #{membership_count} Company Group membership(s). Remove memberships first.",
                reason: "has_company_group_memberships",
                count: membership_count
              }, status: :unprocessable_entity
            end
          end
        end

        # Check if this contact has a Company record pointing to it
        linked_company = CorporateCompany.find_by(contact_id: @contact.id)
        if linked_company.present?
          return render json: {
            success: false,
            error: "Cannot delete contact - Company '#{linked_company.name}' is linked to this contact. Unlink from Corporate first.",
            reason: "company_linked_to_contact",
            linked_company_id: linked_company.id
          }, status: :unprocessable_entity
        end

        # Check for active Xero sync links (SSoT protection)
        xero_links = @contact.external_links.where(source: "xero")
        if xero_links.any?
          return render json: {
            success: false,
            error: "Cannot delete contact with #{xero_links.count} active Xero link#{'s' if xero_links.count != 1}. Unlink from Xero first.",
            reason: "has_xero_links",
            count: xero_links.count,
            tenant_names: xero_links.map(&:tenant_name).compact.uniq
          }, status: :unprocessable_entity
        end

        # Check for data that requires archiving instead of deletion
        archive_reasons = []

        # Check for external invoices/bills (Xero, MYOB, QuickBooks)
        if @contact.external_invoices.any?
          invoice_count = @contact.external_invoices.active.count
          invoice_types = @contact.external_invoices.active.pluck(:invoice_type).uniq

          if invoice_count > 0
            type_labels = invoice_types.map { |t| t == "sales_invoice" ? "invoice" : t }.join(", ")
            archive_reasons << "#{invoice_count} #{type_labels}#{'s' if invoice_count != 1}"
          end
        end

        # Check for contact activities (emails, calls, notes)
        if @contact.contact_activities.any?
          activities_count = @contact.contact_activities.count
          archive_reasons << "#{activities_count} activity record#{'s' if activities_count != 1}"
        end

        # Check for SMS messages
        if @contact.sms_messages.any?
          sms_count = @contact.sms_messages.count
          archive_reasons << "#{sms_count} SMS message#{'s' if sms_count != 1}"
        end

        # Check for jobs
        if @contact.jobs.any?
          jobs_count = @contact.jobs.count
          archive_reasons << "#{jobs_count} linked job#{'s' if jobs_count != 1}"
        end

        # Check for quote responses
        if @contact.quote_responses.any?
          quotes_count = @contact.quote_responses.count
          archive_reasons << "#{quotes_count} quote response#{'s' if quotes_count != 1}"
        end

        # Check for subcontractor invoices
        if @contact.subcontractor_invoices.any?
          sub_invoices_count = @contact.subcontractor_invoices.count
          archive_reasons << "#{sub_invoices_count} subcontractor invoice#{'s' if sub_invoices_count != 1}"
        end

        # If there are reasons to archive, do soft delete instead
        if archive_reasons.any?
          @contact.update!(is_active: false)

          return render json: {
            success: true,
            archived: true,
            message: "Contact archived (not deleted) to preserve #{archive_reasons.join(', ')}.",
            archive_reasons: archive_reasons
          }
        end

        # Check for purchase orders (where this contact is the supplier)
        if @contact.purchase_orders.any?
          # Check if any POs have been paid or invoiced
          paid_pos = @contact.purchase_orders
                            .where("status IN (?) OR amount_paid > 0 OR amount_invoiced > 0",
                                   [ "paid", "invoiced", "received" ])

          if paid_pos.any?
            # Auto-archive instead of blocking
            @contact.update!(is_active: false)

            return render json: {
              success: true,
              archived: true,
              message: "Contact archived (not deleted) to preserve #{paid_pos.count} paid/invoiced purchase order(s).",
              archive_reasons: [ "#{paid_pos.count} paid/invoiced purchase order#{'s' if paid_pos.count != 1}" ]
            }
          end

          # Check for any purchase orders at all
          total_pos = @contact.purchase_orders.count
          if total_pos > 0
            # Auto-archive instead of blocking
            @contact.update!(is_active: false)

            return render json: {
              success: true,
              archived: true,
              message: "Contact archived (not deleted) to preserve #{total_pos} purchase order(s).",
              archive_reasons: [ "#{total_pos} purchase order#{'s' if total_pos != 1}" ]
            }
          end
        end

        # If all checks pass, delete the contact
        @contact.destroy
        render json: {
          success: true,
          message: "Contact deleted successfully"
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to delete contact: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/deletion_check
      # Pre-flight check before attempting delete - returns warnings and blockers
      def deletion_check
        check = @contact.deletion_check

        # Add controller-level checks not in model
        # Check for Company Group links
        if @contact.link_to_cg
          if @contact.linked_company_id.present?
            company = CorporateCompany.find_by(id: @contact.linked_company_id)
            check[:can_delete] = false
            check[:blockers] << {
              type: "linked_to_company",
              message: "This contact is linked to Company '#{company&.name || 'Unknown'}'.",
              action: "Unlink from Company Group first."
            }
          else
            membership_count = ContactCorporateGroupMembership.where(contact_id: @contact.id).count
            if membership_count > 0
              check[:can_delete] = false
              check[:blockers] << {
                type: "has_company_group_memberships",
                message: "This contact has #{membership_count} Company Group membership(s).",
                action: "Remove memberships first."
              }
            end
          end
        end

        # Check for Xero links
        xero_links = @contact.external_links.where(source: "xero")
        if xero_links.any?
          check[:can_delete] = false
          check[:blockers] << {
            type: "has_xero_links",
            message: "This contact has #{xero_links.count} active Xero link(s).",
            action: "Unlink from Xero first."
          }
        end

        render json: {
          success: true,
          data: {
            contact_id: @contact.id,
            display_name: @contact.display_name,
            is_user: @contact.is_user_cached?,
            is_archived: @contact.archived?,
            **check
          }
        }
      end

      # POST /api/v1/contacts/:id/archive
      # Archive contact instead of delete - preserves all data
      def archive
        if @contact.archived?
          return render json: {
            success: false,
            error: "Contact is already archived"
          }, status: :unprocessable_entity
        end

        @contact.archive!

        render json: {
          success: true,
          message: "Contact archived successfully. Data preserved but hidden from normal views.",
          data: {
            id: @contact.id,
            display_name: @contact.display_name,
            is_active: @contact.is_active,
            archived_at: Time.current
          }
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to archive contact: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/:id/restore
      # Restore an archived contact
      def restore
        unless @contact.archived?
          return render json: {
            success: false,
            error: "Contact is not archived"
          }, status: :unprocessable_entity
        end

        @contact.restore!

        render json: {
          success: true,
          message: "Contact restored successfully.",
          data: {
            id: @contact.id,
            display_name: @contact.display_name,
            is_active: @contact.is_active
          }
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to restore contact: #{e.message}"
        }, status: :internal_server_error
      end

      # PATCH /api/v1/contacts/:id/update_from_bill
      # Updates contact fields from extracted invoice data
      # Expects: { fields: { field_key: value, ... }, bill_id: 123 }

      def bulk_update
        contact_ids = params[:contact_ids]
        roles = params[:roles]

        # Validate contact_ids is present and is an array
        if contact_ids.blank? || !contact_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "contact_ids must be a non-empty array"
          }, status: :unprocessable_entity
        end

        # Validate roles is valid
        if roles.blank? || !roles.is_a?(Array)
          return render json: {
            success: false,
            error: "roles must be a non-empty array"
          }, status: :unprocessable_entity
        end

        invalid_roles = roles - Contact::ROLES
        if invalid_roles.any?
          return render json: {
            success: false,
            error: "Invalid roles: #{invalid_roles.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Update all contacts in a single query using update_all for performance
        # This bypasses validations and callbacks but is much faster for bulk operations
        updated_count = Contact.where(id: contact_ids).update_all(roles: roles)

        if updated_count > 0
          render json: {
            success: true,
            updated_count: updated_count,
            message: "Successfully updated #{updated_count} contact#{updated_count == 1 ? '' : 's'}"
          }
        else
          render json: {
            success: false,
            error: "No contacts found with the provided IDs"
          }, status: :not_found
        end
      rescue => e
        render json: {
          success: false,
          error: "Failed to update contacts: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/fix_name_casing
      # Auto-fix name casing issues by converting to Title Case
      # Params:
      #   contact_ids: Array of contact IDs to fix
      #   fix_type: 'all_caps' or 'all_lowercase' (determines which names to fix)

      def fix_name_casing
        contact_ids = params[:contact_ids]
        fix_type = params[:fix_type] || "all"

        if contact_ids.blank? || !contact_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "contact_ids must be a non-empty array"
          }, status: :unprocessable_entity
        end

        fixed_count = 0
        errors = []

        Contact.where(id: contact_ids).find_each do |contact|
          begin
            changes = {}

            # Fix first_name if needed
            if contact.first_name.present?
              if fix_type == "all_caps" && contact.first_name == contact.first_name.upcase && contact.first_name != contact.first_name.downcase
                changes[:first_name] = titleize_name(contact.first_name)
              elsif fix_type == "all_lowercase" && contact.first_name == contact.first_name.downcase && contact.first_name =~ /[a-z]/
                changes[:first_name] = titleize_name(contact.first_name)
              elsif fix_type == "all"
                # Fix both cases
                if (contact.first_name == contact.first_name.upcase && contact.first_name != contact.first_name.downcase) ||
                   (contact.first_name == contact.first_name.downcase && contact.first_name =~ /[a-z]/)
                  changes[:first_name] = titleize_name(contact.first_name)
                end
              end
            end

            # Fix last_name if needed
            if contact.last_name.present?
              if fix_type == "all_caps" && contact.last_name == contact.last_name.upcase && contact.last_name != contact.last_name.downcase
                changes[:last_name] = titleize_name(contact.last_name)
              elsif fix_type == "all_lowercase" && contact.last_name == contact.last_name.downcase && contact.last_name =~ /[a-z]/
                changes[:last_name] = titleize_name(contact.last_name)
              elsif fix_type == "all"
                # Fix both cases
                if (contact.last_name == contact.last_name.upcase && contact.last_name != contact.last_name.downcase) ||
                   (contact.last_name == contact.last_name.downcase && contact.last_name =~ /[a-z]/)
                  changes[:last_name] = titleize_name(contact.last_name)
                end
              end
            end

            # Fix middle_name if needed
            if contact.middle_name.present?
              if fix_type == "all_caps" && contact.middle_name == contact.middle_name.upcase && contact.middle_name != contact.middle_name.downcase
                changes[:middle_name] = titleize_name(contact.middle_name)
              elsif fix_type == "all_lowercase" && contact.middle_name == contact.middle_name.downcase && contact.middle_name =~ /[a-z]/
                changes[:middle_name] = titleize_name(contact.middle_name)
              elsif fix_type == "all"
                # Fix both cases
                if (contact.middle_name == contact.middle_name.upcase && contact.middle_name != contact.middle_name.downcase) ||
                   (contact.middle_name == contact.middle_name.downcase && contact.middle_name =~ /[a-z]/)
                  changes[:middle_name] = titleize_name(contact.middle_name)
                end
              end
            end

            if changes.any?
              contact.update!(changes)
              fixed_count += 1
            end
          rescue => e
            errors << { id: contact.id, error: e.message }
          end
        end

        render json: {
          success: true,
          fixed_count: fixed_count,
          errors: errors,
          message: "Fixed name casing for #{fixed_count} contact#{fixed_count == 1 ? '' : 's'}"
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to fix name casing: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/fix_email_assignment
      # Fix mixed entity type duplicate emails:
      # - Keep email on the person contact
      # - Clear email from company/trust contacts
      # - Create employment relationships linking person to companies

      def fix_email_assignment
        person_id = params[:person_id]
        company_ids = params[:company_ids]

        if person_id.blank? || company_ids.blank? || !company_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "person_id and company_ids (array) are required"
          }, status: :unprocessable_entity
        end

        person = Contact.find(person_id)
        companies = Contact.where(id: company_ids)

        # Validate person is actually a person
        unless person.entity_type == "person"
          return render json: {
            success: false,
            error: "Contact #{person_id} is not a person (entity_type: #{person.entity_type})"
          }, status: :unprocessable_entity
        end

        # Validate companies are actually companies/trusts
        invalid_companies = companies.reject { |c| %w[company trust sole_trader].include?(c.entity_type) }
        if invalid_companies.any?
          return render json: {
            success: false,
            error: "Some contacts are not companies/trusts: #{invalid_companies.map(&:id).join(', ')}"
          }, status: :unprocessable_entity
        end

        results = {
          email_cleared: [],
          employments_created: [],
          errors: []
        }

        ActiveRecord::Base.transaction do
          companies.each do |company|
            begin
              # Clear email from company
              old_email = company.email
              company.update!(email: nil)
              results[:email_cleared] << { id: company.id, name: company.display_name, old_email: old_email }

              # Create employee_of relationship if it doesn't exist
              unless ContactRelationship.exists?(source_contact_id: person.id, related_contact_id: company.id, relationship_type: "employee_of")
                ContactRelationship.create!(
                  source_contact_id: person.id,
                  related_contact_id: company.id,
                  relationship_type: "employee_of",
                  is_active: true
                )
                results[:employments_created] << { person_id: person.id, company_id: company.id, company_name: company.display_name }
              end
            rescue => e
              results[:errors] << { company_id: company.id, error: e.message }
              raise ActiveRecord::Rollback
            end
          end
        end

        if results[:errors].any?
          render json: {
            success: false,
            error: "Failed to fix email assignment",
            details: results[:errors]
          }, status: :unprocessable_entity
        else
          render json: {
            success: true,
            message: "Fixed email assignment: cleared email from #{results[:email_cleared].size} companies, created #{results[:employments_created].size} employment relationships",
            results: results
          }
        end
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to fix email assignment: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/match_supplier
      # DEPRECATED: This endpoint was for migrating suppliers table to contacts.
      # The suppliers table has been removed - all suppliers are now contacts with type='supplier'.

      def match_supplier
        render json: {
          success: false,
          error: "This endpoint is deprecated. Suppliers are now managed directly as contacts with type='supplier'."
        }, status: :gone
      end

      # GET /api/v1/contacts/:id/categories

      def activities
        # Get contact activities
        contact_activities = @contact.contact_activities.recent.limit(50).map do |activity|
          {
            id: "activity_#{activity.id}",
            activity_type: activity.activity_type,
            description: activity.description,
            metadata: activity.metadata,
            occurred_at: activity.occurred_at,
            created_at: activity.created_at,
            performed_by: activity.performed_by
          }
        end

        # Get SMS messages
        sms_messages = @contact.sms_messages.recent.limit(50).map do |sms|
          {
            id: "sms_#{sms.id}",
            activity_type: sms.direction == "outbound" ? "sms_sent" : "sms_received",
            description: "SMS #{sms.direction == 'outbound' ? 'sent to' : 'received from'} #{sms.direction == 'outbound' ? sms.to_phone : sms.from_phone}: #{sms.body.truncate(100)}",
            metadata: {
              sms_id: sms.id,
              body: sms.body,
              status: sms.status,
              direction: sms.direction
            },
            occurred_at: sms.sent_at || sms.received_at || sms.created_at,
            created_at: sms.created_at,
            performed_by: sms.user
          }
        end

        # Combine and sort by occurred_at
        all_activities = (contact_activities + sms_messages).sort_by { |a| a[:occurred_at] }.reverse.take(50)

        render json: {
          success: true,
          activities: all_activities
        }
      end

      # Portal User Management methods extracted to:
      # concerns/contacts/portal_user_management.rb
      # Methods: create_portal_user, update_portal_user, delete_portal_user

      # GET /api/v1/contacts/:id/internal_messages

      def internal_messages
        # TODO: Implement internal messages functionality
        # For now, return an empty array to prevent frontend errors
        render json: {
          success: true,
          messages: []
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to fetch messages: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/documents
      # Returns WarehouseDocument records for this contact (including migrated Xero PDFs)
      # Optional params:
      #   - tab_key: Filter by EntityTab (returns docs where document_type is linked to tab via primary or also_show_in)

      def documents
        # SSoT: Query WarehouseDocument records linked to this contact
        documents = WarehouseDocument.where(documentable: @contact)
                                     .includes(:storage_blob)
                                     .order(created_at: :desc)

        # Filter by folder if tab_key provided (simplified - no document_type linkage in WarehouseDocument)
        if params[:tab_key].present?
          # Map tab_key to folder for filtering
          documents = documents.where(folder: params[:tab_key])
        end

        # Build lookup map for ExternalInvoice dates (for Xero docs)
        invoice_dates_map = {}
        xero_docs = documents.select { |d| d.source_type == "xero" }
        if xero_docs.any?
          # WarehouseDocument links to ExternalInvoice via documentable
          invoice_ids = xero_docs.select { |d| d.documentable_type == "ExternalInvoice" }.map(&:documentable_id).compact
          ExternalInvoice.where(id: invoice_ids, source: "xero").find_each do |inv|
            invoice_dates_map[inv.id] = {
              due_date: inv.due_date,
              fully_paid_date: inv.fully_paid_date,
              invoice_date: inv.invoice_date
            }
          end
        end

        # Format response with download URLs
        docs_json = documents.map do |doc|
          # Generate presigned download URL
          download_url = doc.download_url rescue nil

          # Get invoice dates for Xero documents
          invoice_dates = if doc.source_type == "xero" && doc.documentable_type == "ExternalInvoice"
            invoice_dates_map[doc.documentable_id] || {}
          else
            {}
          end

          {
            id: doc.id,
            name: doc.storage_blob&.original_filename || doc.display_name,
            displayName: doc.display_name,
            folder: doc.folder,
            fileSize: doc.storage_blob&.file_size,
            contentType: doc.storage_blob&.content_type,
            source: doc.source_type,
            externalId: nil,  # WarehouseDocument doesn't have external_id
            storagePath: doc.storage_blob&.storage_path,
            storageProvider: "s3_compatible",  # WarehouseDocument always uses S3
            documentType: nil,  # WarehouseDocument doesn't have document_type
            createdAt: doc.created_at&.iso8601,
            updatedAt: doc.updated_at&.iso8601,
            downloadUrl: download_url,
            invoiceDate: invoice_dates[:invoice_date]&.iso8601,
            dueDate: invoice_dates[:due_date]&.iso8601,
            datePaid: invoice_dates[:fully_paid_date]&.iso8601
          }
        end

        render json: {
          success: true,
          exists: documents.any?,
          total: documents.count,
          documents: docs_json
        }
      rescue => e
        Rails.logger.error("[ContactsController#documents] Error: #{e.message}")
        render json: {
          success: false,
          error: "Failed to fetch documents: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/company_group_memberships
      # Returns all corporate group memberships for this contact

      def entity_types
        # Entity type metadata for UI display
        entity_type_metadata = {
          "person" => {
            value: "person",
            label: "Person",
            description: "Individual contact",
            icon: "user",
            has_first_last_name: true,
            can_have_employer: true,
            can_have_employees: false,
            show_in_create_form: true
          },
          "company" => {
            value: "company",
            label: "Company",
            description: "Business entity (Pty Ltd, Ltd, Inc)",
            icon: "building",
            has_first_last_name: false,
            can_have_employer: false,
            can_have_employees: true,
            show_in_create_form: true
          },
          "sole_trader" => {
            value: "sole_trader",
            label: "Sole Trader",
            description: "Individual trading as a business",
            icon: "user",
            has_first_last_name: true,
            can_have_employer: false,
            can_have_employees: true,
            show_in_create_form: true
          },
          "trust" => {
            value: "trust",
            label: "Trust",
            description: "Trust entity (Family Trust, Unit Trust)",
            icon: "building",
            has_first_last_name: false,
            can_have_employer: false,
            can_have_employees: true,
            show_in_create_form: true
          },
          "price_only" => {
            value: "price_only",
            label: "Price Only",
            description: "Contact used only for pricebook pricing (no other info)",
            icon: "dollar",
            has_first_last_name: false,
            can_have_employer: false,
            can_have_employees: false,
            show_in_create_form: false  # Legacy/internal type - don't show in create form
          }
        }

        render json: {
          success: true,
          entity_types: Contact::ENTITY_TYPES,
          metadata: Contact::ENTITY_TYPES.map { |type| entity_type_metadata[type] }
        }
      end

      # GET /api/v1/contacts/employment_statuses
      # SSoT: Returns valid employment statuses from Contact::EMPLOYMENT_STATUSES

      def employment_statuses
        render json: {
          success: true,
          employment_statuses: Contact::EMPLOYMENT_STATUSES,
          metadata: Contact::EMPLOYMENT_STATUSES.map { |status|
            {
              value: status,
              label: status.titleize
            }
          }
        }
      end

      # GET /api/v1/contacts/roles
      # SSoT: Returns valid roles from Contact::ROLES

      def roles
        render json: {
          success: true,
          roles: Contact::ROLES,
          metadata: Contact::ROLES.map { |role|
            {
              value: role,
              label: role.titleize.gsub("_", " ")
            }
          }
        }
      end

      # GET /api/v1/contacts/invalid_entity_types
      # Health check: Find contacts with invalid entity_type values

      # GET /api/v1/contacts/frequent
      # Returns contacts the user emails most frequently
      # Used by compose modal to show quick-add contact chips
      def frequent
        # Get email addresses the user has sent to most frequently
        # Use tenant_id for multi-tenancy
        email_counts = SyncedEmail
          .where(tenant_id: current_user&.tenant_id)
          .where(direction: "sent")
          .where.not(to_emails: nil)
          .pluck(:to_emails, :cc_emails)
          .flatten
          .compact
          .flatten
          .map(&:downcase)
          .tally
          .sort_by { |_email, count| -count }
          .first(20)
          .to_h

        # Match emails to contacts
        frequent_emails = email_counts.keys
        contacts_with_emails = Contact
          .joins(:contact_emails)
          .where("LOWER(contact_emails.email) IN (?)", frequent_emails)
          .includes(:contact_emails, :primary_company)
          .distinct
          .limit(15)

        # Build response with email counts
        result = contacts_with_emails.map do |contact|
          email = contact.contact_emails.find { |ce| frequent_emails.include?(ce.email&.downcase) }&.email
          {
            id: contact.id,
            display_name: contact.display_name,
            email: email || contact.email,
            email_count: email_counts[email&.downcase] || 0,
            primary_company: contact.primary_company ? {
              id: contact.primary_company.id,
              name: contact.primary_company.display_name
            } : nil
          }
        end

        # Sort by email count descending
        result.sort_by! { |c| -c[:email_count] }

        render json: { success: true, data: result }
      end

      private

      def titleize_name(name)
        return name if name.blank?

        # Split by spaces and titleize each word
        name.split(/\s+/).map do |word|
          # Handle names with apostrophes like O'Brien
          if word.include?("'")
            word.split("'").map(&:capitalize).join("'")
          else
            word.capitalize
          end
        end.join(" ")
      end


      def set_contact
        id_or_slug = params[:id]

        # Eager load associations for show action to avoid N+1 queries
        # This reduces the show action from ~500ms to ~50ms
        # Note: :corporate_group removed - Contact uses :corporate_groups_via_membership (has_many through)
        eager_load_associations = if action_name == "show"
          [:contact_emails, :contact_phones, :contact_persons, :contact_addresses,
           :contact_groups, :portal_user]
        else
          []
        end

        # Build base query - only add includes if there are associations to load
        base_query = eager_load_associations.any? ? Contact.includes(*eager_load_associations) : Contact

        if id_or_slug.to_s.match?(/\A\d+\z/)
          # Numeric ID - direct lookup
          @contact = base_query.find(id_or_slug)
        else
          # Slug - search by name (convert slug back to search term)
          # Remove the _God_Loves_You_ suffix if present
          slug = id_or_slug.to_s.gsub(/_God_Loves_You_$/i, "")
          search_term = slug.gsub("-", " ")

          # Try exact substring match first
          @contact = base_query
                           .where("LOWER(display_name) LIKE ?", "%#{search_term.downcase}%").first

          # If not found, try matching all words (handles middle names)
          # e.g., "rachel harder" should match "Rachel Anne Harder"
          unless @contact
            words = search_term.downcase.split(/\s+/).reject(&:blank?)
            if words.any?
              conditions = words.map { |w| "LOWER(display_name) LIKE '%#{Contact.sanitize_sql_like(w)}%'" }.join(" AND ")
              @contact = base_query.where(conditions).first
            end
          end

          raise ActiveRecord::RecordNotFound, "Contact not found with slug: #{id_or_slug}" unless @contact
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # sync_addresses_from_xero extracted to: concerns/contacts/xero_sync.rb


      def handle_contact_groups
        # Clear existing group memberships
        @contact.contact_group_memberships.destroy_all

        # Add to existing groups
        if params[:contact][:contact_group_ids].present?
          params[:contact][:contact_group_ids].each do |group_id|
            group = ContactGroup.find(group_id)
            @contact.contact_group_memberships.create!(contact_group: group)
          end
        end

        # Create new groups and add contact to them
        if params[:contact][:new_contact_group_names].present?
          params[:contact][:new_contact_group_names].each do |group_name|
            group = ContactGroup.find_or_create_by!(name: group_name, status: "ACTIVE")
            @contact.contact_group_memberships.create!(contact_group: group) unless @contact.contact_groups.include?(group)
          end
        end
      end

      # SSoT: Confidential fields that require permission to view
      CONFIDENTIAL_FIELDS = %w[
        tfn tax_number date_of_birth place_of_birth birth_state birth_country
        residential_address drivers_licence passport_number
        bank_bsb bank_account_number bank_account_name
      ].freeze

      # Filter confidential fields from contact JSON based on user permissions

      def filter_confidential_fields(contact_json)
        return contact_json if current_user&.can_view_confidential?

        CONFIDENTIAL_FIELDS.each do |field|
          if contact_json.key?(field) && contact_json[field].present?
            contact_json[field] = "[RESTRICTED]"
          end
        end

        contact_json
      end


      def contact_params
        # Exclude Xero read-only fields from manual updates
        # These fields are synced from Xero and should not be edited directly in TEEEM
        permitted = params.require(:contact).permit(
          :display_name,
          :first_name,
          :middle_name,
          :last_name,
          :email,
          :mobile_phone,
          :office_phone,
          :direct_line,
          :fax_phone,
          :website,
          :tax_number,
          :abn,
          :acn,
          :sys_type_id,
          :parent_id,
          :parent,
          :drive_id,
          :folder_id,
          :sync_with_xero,
          :contact_region_id,
          :contact_region,
          :branch,
          :rating,
          :response_rate,
          :avg_response_time,
          :is_active,
          :supplier_code,
          :address,
          :notes,
          :entity_type,
          :company_name_or_trust, # SSoT for company/trust names
          # Family/Director fields
          :is_family_member,
          :is_potential_director,
          :company_group_id,
          :is_team_contact,
          # Supplier team configuration (for auto-calculating task duration)
          :team_size,
          :daily_rate_per_person,
          # NOTE: primary_company_id is now READ-ONLY (auto-synced from ContactRelationship)
          # NOTE: Xero accounting fields (bank details, payment terms, balances) are READ-ONLY
          # They are synced from Xero and cannot be edited in TEEEM
          # See Contact::XERO_READ_ONLY_FIELDS for the full list
          roles: [],
          lgas: [],
          contact_group_ids: [],
          new_contact_group_names: [],
          # Nested attributes for multiple emails
          contact_emails_attributes: [ :id, :email, :is_primary, :label, :position, :_destroy ],
          # Nested attributes for multiple phones
          contact_phones_attributes: [ :id, :phone_number, :phone_type, :is_primary, :label, :position, :_destroy ],
          # Nested attributes for contact persons
          contact_persons_attributes: [ :id, :first_name, :last_name, :email, :mobile, :role, :include_in_emails, :is_primary, :_destroy ],
          # Nested attributes for contact addresses
          contact_addresses_attributes: [ :id, :address_type, :line1, :line2, :line3, :line4, :city, :region, :postal_code, :country, :attention_to, :is_primary, :_destroy ]
        )

        # Convert roles from integer IDs to names if needed
        # Frontend may send [1, 2] (IDs) instead of ['Employee', 'Director'] (names)
        if permitted[:roles].present?
          permitted[:roles] = convert_role_ids_to_names(permitted[:roles])
        end

        permitted
      end

      # Convert role IDs to names
      # Example: [1, 2] -> ['Employee', 'Director'] (if ContactType records exist with those IDs)
      # Also accepts: ['Employee', 'Director'] -> ['Employee', 'Director'] (no change)

      def convert_role_ids_to_names(role_ids)
        return [] if role_ids.blank?

        role_ids.map do |role|
          if role.is_a?(Integer) || (role.is_a?(String) && role.match?(/^\d+$/))
            # It's an ID, look up the name
            ContactType.find_by(id: role.to_i)&.name
          else
            # It's already a name
            role
          end
        end.compact
      end

      # Performance: Pre-compute is_customer?, is_supplier?, is_director? via SQL
      # Performance: Reads cached boolean columns directly (single query)
      # Previously ran 6 separate queries, now reads from is_*_cached columns
      # Returns: { contact_id => { is_customer: bool, is_supplier: bool, is_director: bool } }
      def precompute_contact_flags(contact_ids)
        return {} if contact_ids.blank?

        flags = {}

        # Single query to get all cached flags
        Contact.where(id: contact_ids)
          .pluck(:id, :is_customer_cached, :is_supplier_cached, :is_director_cached)
          .each do |id, is_customer, is_supplier, is_director|
            flags[id] = {
              is_customer: is_customer,
              is_supplier: is_supplier,
              is_director: is_director
            }
          end

        flags
      end

    end
  end
end
