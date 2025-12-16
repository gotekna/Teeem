module Api
  module V1
    class ContactsController < ApplicationController
      # SSoT: Extract related functionality into concerns to reduce file size
      include Contacts::PortalUserManagement
      include Contacts::XeroSync

      before_action :set_contact, only: [ :show, :update, :destroy, :activities, :link_xero_contact, :sync_from_xero, :sync_to_xero, :create_portal_user, :update_portal_user, :delete_portal_user, :internal_messages, :company_group_memberships, :directorships, :shareholdings, :trust_roles, :ownership_chain, :enrich_from_web, :reorder_employees, :reorder_companies, :coworkers ]
      before_action :require_corporate_permission, only: [ :directorships, :shareholdings, :trust_roles, :ownership_chain ]

      # GET /api/v1/contacts/read_only_fields
      # Returns the list of Xero-synced fields that are read-only in TEEEM
      def read_only_fields
        render json: {
          success: true,
          read_only_fields: Contact::XERO_READ_ONLY_FIELDS,
          message: "These fields are synced from Xero and cannot be edited in TEEEM"
        }
      end

      # GET /api/v1/contacts
      def index
        # Show all active contacts
        @contacts = Contact.all

        # Filter to only show actual company directors (from company_directors table)
        if params[:is_director] == "true"
          director_contact_ids = CorporateCompanyDirector.where(is_current: true).pluck(:contact_id).uniq
          @contacts = @contacts.where(id: director_contact_ids)
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
        if params[:search].present?
          search_term = "%#{params[:search]}%"

          # Find contacts that match the search term directly
          direct_matches = @contacts.left_outer_joins(:primary_company).where(
            "contacts.display_name ILIKE :q OR
             contacts.email ILIKE :q OR
             contacts.first_name ILIKE :q OR
             contacts.last_name ILIKE :q OR
             (contacts.is_team_contact = true AND companies_contacts.display_name ILIKE :q)",
            q: search_term
          )

          # Find companies that match the search term
          matching_company_ids = Contact.where("display_name ILIKE ?", search_term)
                                       .where(entity_type: %w[company trust sole_trader])
                                       .pluck(:id)

          if matching_company_ids.any?
            # Find employees of those companies (via primary_company_id OR via relationships)
            employee_relationship_ids = ContactRelationship
              .active
              .where(relationship_type: "employee_of")
              .where(related_contact_id: matching_company_ids)
              .pluck(:contact_id)

            employee_primary_company_ids = Contact.where(primary_company_id: matching_company_ids).pluck(:id)

            employee_ids = (employee_relationship_ids + employee_primary_company_ids).uniq

            # Combine direct matches with employees of matching companies
            @contacts = @contacts.where(id: direct_matches.pluck(:id) + matching_company_ids + employee_ids)
          else
            @contacts = direct_matches
          end
        end

        # Filter by role (updated from deprecated contact_types to roles)
        if params[:role].present?
          @contacts = @contacts.with_role(params[:role])
        end

        # Legacy support for old :type param (deprecated - use :role instead)
        # customer/supplier roles have been removed and converted to 'Employee'
        if params[:type].present? && params[:role].blank?
          case params[:type]
          when "customers", "suppliers", "both"
            @contacts = @contacts.employees # All converted to Employee role
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

        # Filter to only show possible duplicate contacts
        if params[:duplicates_only] == "true"
          # Find contacts that share a normalized display_name with at least one other contact
          duplicate_ids = find_duplicate_contact_ids
          @contacts = @contacts.where(id: duplicate_ids)
        end

        # Filter by having contact info
        @contacts = @contacts.with_email if params[:with_email] == "true"
        @contacts = @contacts.with_phone if params[:with_phone] == "true"

        # Filter by entity type (person, company, trust)
        if params[:entity_type].present?
          @contacts = @contacts.where(entity_type: params[:entity_type])
        end

        @contacts = @contacts.order(:display_name)

        # Optionally include companies and jobs data
        include_companies = params[:include_companies] == "true"
        include_jobs = params[:include_jobs] == "true"

        # Include director details if filtering for directors
        director_fields = params[:is_director] == "true" ? [ :place_of_birth, :birth_state, :birth_country, :residential_address ] : []

        contacts_json = @contacts.as_json(
          include: {
            portal_user: {},
            corporate_group: {}
          },
          methods: [ :is_customer?, :is_supplier?, :is_sales?, :is_land_agent?, :display_name, :is_director?, :company_group_memberships_count, :xero_linked_count, :xero_customer?, :xero_supplier? ]
        )

        # Add company and job counts for all contacts
        if include_companies || include_jobs
          contacts_json.each do |contact_json|
            contact = @contacts.find { |c| c.id == contact_json["id"] }
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
              # Count jobs
              contact_json["jobs_count"] = contact.job_contacts.count
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
            portal_user: {},
            corporate_group: {}
          },
          methods: [ :is_customer?, :is_supplier?, :is_sales?, :is_land_agent?, :is_director?, :director_companies, :display_name ]
        )

        # If contact is a supplier, add pricebook items and purchase orders
        if @contact.is_supplier?
          # Get items where this contact is the supplier OR default_supplier OR has provided a quote (in price_histories)
          # Optimized to use a single query with LEFT JOIN instead of 3 separate queries
          # Note: PricebookItem uses table_name = 'pricebook', not 'pricebook_items'
          all_items = PricebookItem
            .left_joins(:price_histories)
            .where(
              "pricebook.supplier_id = ? OR pricebook.default_supplier_id = ? OR price_histories.supplier_id = ?",
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
        @contact = Contact.new(contact_params)

        if @contact.save
          render json: { success: true, contact: @contact }, status: :created
        else
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/contacts/:id
      def update
        # Handle contact groups separately
        if params[:contact][:contact_group_ids] || params[:contact][:new_contact_group_names]
          handle_contact_groups
        end

        if @contact.update(contact_params.except(:contact_group_ids, :new_contact_group_names))
          render json: {
            success: true,
            contact: @contact.as_json(
              methods: [ :is_employee?, :is_sales?, :is_land_agent? ]
            )
          }
        else
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:id
      def destroy
        # Comprehensive safety checks before deletion

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

      # Xero Sync methods extracted to: concerns/contacts/xero_sync.rb
      # Methods: link_to_xero_tenant, link_xero_contact, sync_from_xero, sync_to_xero

      # POST /api/v1/contacts/:id/reorder_employees
      # Updates the display_order of employees for a company contact
      # Expects: { employee_ids: [123, 456, 789] } (in desired order)
      def reorder_employees
        unless @contact.entity_type == "company" || @contact.entity_type == "trust"
          return render json: {
            success: false,
            error: "Only company or trust contacts can have employees"
          }, status: :unprocessable_entity
        end

        employee_ids = params[:employee_ids]
        unless employee_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "employee_ids must be an array"
          }, status: :unprocessable_entity
        end

        # Update display_order for each employee relationship
        ActiveRecord::Base.transaction do
          employee_ids.each_with_index do |employee_id, index|
            relationship = @contact.incoming_relationships
              .active
              .where(relationship_type: "employee_of")
              .find_by(source_contact_id: employee_id)

            if relationship
              relationship.update!(display_order: index)
            end
          end
        end

        render json: {
          success: true,
          message: "Employee order updated successfully"
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to reorder employees: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/:id/reorder_companies
      # Updates the display_order of companies for a person contact
      # Expects: { company_ids: [123, 456, 789] } (in desired order)
      def reorder_companies
        unless @contact.entity_type == "person"
          return render json: {
            success: false,
            error: "Only person contacts can have ordered companies"
          }, status: :unprocessable_entity
        end

        company_ids = params[:company_ids]
        unless company_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "company_ids must be an array"
          }, status: :unprocessable_entity
        end

        # Update display_order for each company relationship (outgoing from person)
        ActiveRecord::Base.transaction do
          company_ids.each_with_index do |company_id, index|
            # Find outgoing relationship from this person to the company
            relationship = @contact.outgoing_relationships
              .active
              .find_by(related_contact_id: company_id)

            if relationship
              relationship.update!(display_order: index)
            end
          end
        end

        # Update primary_company_id to be the first company in the list
        # Primary company is the first company in any company-related relationship
        if company_ids.any? && @contact.primary_company_id != company_ids.first
          @contact.update!(primary_company_id: company_ids.first)
        end

        render json: {
          success: true,
          message: "Company order updated successfully"
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to reorder companies: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/:id/enrich_from_web
      # Enriches a contact by scraping their website and determining if they need a company
      # Can use either email domain or website URL as the source
      def enrich_from_web
        domain = nil

        # First try to extract domain from email
        if @contact.email.present?
          domain = @contact.email.split("@").last.to_s.downcase

          # Check for generic email domains - fall back to website if generic
          generic_domains = [ "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com" ]
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
        existing_contact_with_company = Contact.joins(:primary_company)
                                               .where("contacts.email LIKE ?", "%@#{domain}")
                                               .where.not(id: @contact.id)
                                               .includes(:primary_company)
                                               .first

        if existing_contact_with_company && existing_contact_with_company.primary_company
          # Found existing company for this domain - link to it
          company_contact = existing_contact_with_company.primary_company
          company = CorporateCompany.find_by(contact_id: company_contact.id)

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
            existing_company = CorporateCompany.find_by(abn: website_details[:abn]) if website_details[:abn].present?
            existing_company ||= CorporateCompany.find_by(acn: website_details[:acn]) if website_details[:acn].present?

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
              # Create new company
              company_contact = Contact.create!(
                display_name: company_name,
                entity_type: "company",
                is_active: true,
                created_by: current_user.id,
                website: website_details[:website],
                office_phone: website_details[:phone],
                email: website_details[:email]
              )

              company = CorporateCompany.create!(
                name: company_name,
                contact_id: company_contact.id,
                status: "active",
                abn: website_details[:abn],
                acn: website_details[:acn],
                registered_office_address: website_details[:address],
                purpose: website_details[:description]
              )

              # Link person to company
              @contact.update!(primary_company_id: company_contact.id)

              company_created = true
              company_info = {
                id: company.id,
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
        Rails.logger.error("ContactsController#enrich_from_web error: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))

        render json: {
          success: false,
          error: e.message
        }, status: :internal_server_error
      end

      # PATCH /api/v1/contacts/bulk_update
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
      def categories
        contact = Contact.find(params[:id])

        unless contact.is_supplier?
          return render json: {
            success: false,
            error: "Contact must be a supplier"
          }, status: :unprocessable_entity
        end

        # Get distinct categories from pricebook items where this contact is the default supplier
        # or has provided price histories
        categories_from_default = PricebookItem.where(default_supplier_id: contact.id)
                                              .where.not(category: nil)
                                              .distinct
                                              .pluck(:category)

        categories_from_histories = PricebookItem.joins(:price_histories)
                                                .where(price_histories: { supplier_id: contact.id })
                                                .where.not(category: nil)
                                                .distinct
                                                .pluck(:category)

        all_categories = (categories_from_default + categories_from_histories).uniq.sort

        # Get item counts per category
        categories_with_counts = all_categories.map do |category|
          default_count = PricebookItem.where(default_supplier_id: contact.id, category: category).count
          history_count = PricebookItem.joins(:price_histories)
                                      .where(price_histories: { supplier_id: contact.id })
                                      .where(category: category)
                                      .distinct
                                      .count

          {
            category: category,
            default_supplier_count: default_count,
            price_history_count: history_count,
            total_count: [ default_count, history_count ].max
          }
        end

        render json: {
          success: true,
          categories: categories_with_counts
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to fetch categories: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/:id/copy_price_history
      def copy_price_history
        source_id = params[:source_id]
        categories = params[:categories] # Optional array of categories to filter by
        set_as_default = params[:set_as_default] != false # Default to true unless explicitly false
        effective_date = params[:effective_date].present? ? Date.parse(params[:effective_date]) : CorporateCompanySetting.today

        # Which price to copy: 'active' (default), 'latest', or 'oldest'
        # - active: Most recent date_effective (current active price)
        # - latest: Most recently created price history
        # - oldest: Oldest price history (original price)
        copy_mode = params[:copy_mode].presence || "active"

        Rails.logger.info "===== COPY PRICE HISTORY DEBUG ====="
        Rails.logger.info "params[:effective_date] = #{params[:effective_date].inspect}"
        Rails.logger.info "effective_date after parsing = #{effective_date.inspect}"
        Rails.logger.info "copy_mode = #{copy_mode.inspect}"
        Rails.logger.info "======================================="

        if source_id.blank?
          return render json: {
            success: false,
            error: "source_id is required"
          }, status: :bad_request
        end

        target_contact = Contact.find(params[:id])
        source_contact = Contact.find(source_id)

        unless target_contact.is_supplier? || source_contact.is_supplier?
          return render json: {
            success: false,
            error: "Both contacts must be suppliers"
          }, status: :unprocessable_entity
        end

        copied_count = 0
        updated_count = 0

        ActiveRecord::Base.transaction do
          # Get all pricebook items that have price histories from the source supplier
          # Order depends on copy_mode parameter
          order_clause = case copy_mode
          when "latest"
            "pricebook_item_id, created_at DESC"
          when "oldest"
            "pricebook_item_id, created_at ASC"
          else # 'active' (default)
            "pricebook_item_id, date_effective DESC NULLS LAST, created_at DESC"
          end

          source_price_histories = PriceHistory.where(supplier_id: source_id)
            .joins(:pricebook_item)
            .select("DISTINCT ON (pricebook_item_id) price_histories.*")
            .order(order_clause)

          # Filter by categories if provided
          # Note: PricebookItem uses table_name = 'pricebook', not 'pricebook_items'
          if categories.present? && categories.is_a?(Array) && categories.any?
            source_price_histories = source_price_histories.where(pricebook: { category: categories })
          end

          source_price_histories.each do |selected_price_history|
            item = selected_price_history.pricebook_item

            # Only set target as the new default supplier if requested
            if set_as_default
              item.update!(default_supplier_id: target_contact.id)
              updated_count += 1
            end

            # Check if target already has a price history with the same price and effective date
            # This prevents exact duplicates but allows new price histories with different dates
            existing_history = PriceHistory.where(
              pricebook_item_id: item.id,
              supplier_id: target_contact.id,
              new_price: selected_price_history.new_price,
              date_effective: effective_date
            ).exists?

            # Only create if this exact price/date combination doesn't exist
            unless existing_history
              PriceHistory.create!(
                pricebook_item_id: item.id,
                old_price: selected_price_history.old_price,
                new_price: selected_price_history.new_price,
                supplier_id: target_contact.id,
                lga: selected_price_history.lga,
                date_effective: effective_date,
                change_reason: "Copied from #{source_contact.display_name}"
              )
              copied_count += 1
            end
          end
        end

        category_msg = if categories.present? && categories.any?
          " for #{categories.join(', ')} categories"
        else
          ""
        end

        message = if set_as_default
          "Copied #{copied_count} price histories and set as default supplier for #{updated_count} items#{category_msg}"
        else
          "Copied #{copied_count} price histories#{category_msg}"
        end

        render json: {
          success: true,
          message: message,
          copied_count: copied_count,
          updated_count: updated_count,
          source_contact: source_contact.display_name,
          target_contact: target_contact.display_name,
          categories: categories || [],
          set_as_default: set_as_default
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to copy price history: #{e.message}"
        }, status: :internal_server_error
      end

      # DELETE /api/v1/contacts/:id/remove_from_categories
      def remove_from_categories
        categories = params[:categories] # Array of categories to remove supplier from

        if categories.blank? || !categories.is_a?(Array) || categories.empty?
          return render json: {
            success: false,
            error: "categories (array) is required"
          }, status: :bad_request
        end

        contact = Contact.find(params[:id])

        unless contact.is_supplier?
          return render json: {
            success: false,
            error: "Contact must be a supplier"
          }, status: :unprocessable_entity
        end

        removed_from_default_count = 0
        deleted_price_histories_count = 0

        ActiveRecord::Base.transaction do
          # Find all pricebook items where this contact is the default supplier
          # and the category is in the provided list
          default_supplier_items = PricebookItem.where(
            default_supplier_id: contact.id,
            category: categories
          )

          default_supplier_items.each do |item|
            # Set default_supplier_id to nil (unset the supplier)
            item.update!(default_supplier_id: nil)
            removed_from_default_count += 1
          end

          # Delete all price histories for this supplier in the selected categories
          # This removes the supplier's pricing from items even if they weren't the default
          # Note: PricebookItem uses table_name = 'pricebook', not 'pricebook_items'
          price_histories_to_delete = PriceHistory.joins(:pricebook_item)
            .where(supplier_id: contact.id)
            .where(pricebook: { category: categories })

          deleted_price_histories_count = price_histories_to_delete.count
          price_histories_to_delete.delete_all
        end

        message_parts = []
        message_parts << "Removed as default supplier from #{removed_from_default_count} items" if removed_from_default_count > 0
        message_parts << "Deleted #{deleted_price_histories_count} price histories" if deleted_price_histories_count > 0

        message = if message_parts.any?
          "#{message_parts.join(' and ')} in #{categories.join(', ')}"
        else
          "No items or price histories found for this supplier in #{categories.join(', ')}"
        end

        render json: {
          success: true,
          message: message,
          removed_from_default_count: removed_from_default_count,
          deleted_price_histories_count: deleted_price_histories_count,
          categories: categories
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to remove from categories: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/contacts/merge
      def merge
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
            # Merge roles
            merged_roles = (target_contact.roles + source.roles).uniq
            target_contact.update(roles: merged_roles)

            # Fill in missing contact information from source if target is missing it
            target_contact.update(email: source.email) if target_contact.email.blank? && source.email.present?
            target_contact.update(mobile_phone: source.mobile_phone) if target_contact.mobile_phone.blank? && source.mobile_phone.present?
            target_contact.update(office_phone: source.office_phone) if target_contact.office_phone.blank? && source.office_phone.present?
            target_contact.update(website: source.website) if target_contact.website.blank? && source.website.present?
            # Merge addresses from contact_addresses (SSoT)
            if target_contact.contact_addresses.empty? && source.contact_addresses.any?
              source.contact_addresses.each do |addr|
                target_contact.contact_addresses.create!(
                  address_type: addr.address_type,
                  line1: addr.line1,
                  line2: addr.line2,
                  line3: addr.line3,
                  line4: addr.line4,
                  city: addr.city,
                  region: addr.region,
                  postal_code: addr.postal_code,
                  country: addr.country,
                  is_primary: addr.is_primary
                )
              end
            end

            # Merge supplier-specific fields (if both are suppliers)
            if source.is_supplier? && target_contact.is_supplier?
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

            # Update foreign keys from source to target
            # These associations now point directly to contacts (supplier_id = contact_id after migration)
            PricebookItem.where(supplier_id: source.id).update_all(supplier_id: target_id)
            PurchaseOrder.where(supplier_id: source.id).update_all(supplier_id: target_id)
            PriceHistory.where(supplier_id: source.id).update_all(supplier_id: target_id)

            # Transfer Company Group links from source to target (SSoT)
            if source.link_to_cg
              # Transfer linked_company_id if source has one and target doesn't
              if source.linked_company_id.present? && target_contact.linked_company_id.blank?
                # Update the Company record to point to target contact
                CorporateCompany.where(contact_id: source.id).update_all(contact_id: target_id)
                target_contact.update(linked_company_id: source.linked_company_id, link_to_cg: true)
              end

              # Transfer Company Group memberships to target
              ContactCorporateGroupMembership.where(contact_id: source.id).each do |membership|
                # Check if target already has this membership
                existing = ContactCorporateGroupMembership.find_by(
                  contact_id: target_id,
                  company_group_id: membership.company_group_id
                )
                if existing
                  # Merge permissions - keep the higher permission level
                  existing.update(
                    can_view_confidential: existing.can_view_confidential || membership.can_view_confidential,
                    can_edit: existing.can_edit || membership.can_edit
                  )
                  membership.destroy
                else
                  # Transfer membership to target
                  membership.update(contact_id: target_id)
                end
              end

              # Mark target as linked to CG if source was
              target_contact.update(link_to_cg: true) unless target_contact.link_to_cg
            end

            # Transfer ContactRelationships (company/employee relationships)
            # Outgoing relationships (source is the person, related_contact is the company)
            source.outgoing_relationships.each do |relationship|
              # Check if target already has this relationship
              existing = target_contact.outgoing_relationships.find_by(
                related_contact_id: relationship.related_contact_id,
                relationship_type: relationship.relationship_type
              )

              if existing
                # Relationship already exists, destroy the duplicate
                relationship.destroy
              else
                # Transfer relationship to target
                relationship.update(source_contact_id: target_id)
              end
            end

            # Incoming relationships (source is the company, related_contact is the person)
            source.incoming_relationships.each do |relationship|
              # Check if target already has this relationship
              existing = target_contact.incoming_relationships.find_by(
                source_contact_id: relationship.source_contact_id,
                relationship_type: relationship.relationship_type
              )

              if existing
                # Relationship already exists, destroy the duplicate
                relationship.destroy
              else
                # Transfer relationship to target
                relationship.update(related_contact_id: target_id)
              end
            end

            # Transfer primary_company_id if source has one and target doesn't
            if source.primary_company_id.present? && target_contact.primary_company_id.blank?
              target_contact.update(primary_company_id: source.primary_company_id)
            end

            # Transfer Xero links (contact_external_links)
            source.xero_links.each do |xero_link|
              # Check if target already has a link to this Xero tenant
              existing = target_contact.xero_links.find_by(
                tenant_id: xero_link.tenant_id,
                source: xero_link.source
              )

              if existing
                # Check if they point to different Xero contacts
                if xero_link.external_contact_id != existing.external_contact_id
                  # Different Xero contact IDs - one is stale, transfer it and mark as stale
                  # This prevents the stale Xero contact from being recreated during next sync
                  xero_link.mark_stale!('not_found')
                  xero_link.update!(
                    contact_id: target_id,
                    sync_error: "Contact merged - duplicate Xero link marked as stale"
                  )
                  Rails.logger.info "[ContactMerge] Transferred stale Xero link: #{xero_link.external_contact_id}"
                else
                  # Same Xero contact ID - true duplicate, safe to delete
                  Rails.logger.info "[ContactMerge] Deleting duplicate Xero link to #{xero_link.tenant_name}"
                  xero_link.destroy
                end
              else
                # Transfer this Xero link to target
                xero_link.update(contact_id: target_id)
                Rails.logger.info "[ContactMerge] Transferred Xero link to #{xero_link.tenant_name}"
              end
            end

            # Transfer job associations
            source.job_contacts.each do |job_contact|
              # Check if target already has this job association
              existing = target_contact.job_contacts.find_by(job_id: job_contact.job_id)

              if existing
                job_contact.destroy
              else
                job_contact.update(contact_id: target_id)
              end
            end

            # Transfer case associations
            source.case_contacts.each do |case_contact|
              # Check if target already has this case association
              existing = target_contact.case_contacts.find_by(case_record_id: case_contact.case_record_id)

              if existing
                case_contact.destroy
              else
                case_contact.update(contact_id: target_id)
              end
            end

            # Delete the source contact
            source.destroy
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

      # POST /api/v1/contacts/:id/bulk_update_prices
      def bulk_update_prices
        updates = params[:updates] # Array of {item_id, new_price, change_reason, date_effective}

        if updates.blank? || !updates.is_a?(Array) || updates.empty?
          return render json: {
            success: false,
            error: "updates (array) is required and must not be empty"
          }, status: :bad_request
        end

        contact = Contact.find(params[:id])

        unless contact.is_supplier?
          return render json: {
            success: false,
            error: "Contact must be a supplier"
          }, status: :unprocessable_entity
        end

        updated_count = 0
        errors = []

        ActiveRecord::Base.transaction do
          updates.each do |update|
            item_id = update[:item_id]
            new_price = update[:new_price].to_f
            change_reason = update[:change_reason].presence || "bulk_update"
            date_effective = update[:date_effective].present? ? Date.parse(update[:date_effective].to_s) : CorporateCompanySetting.today

            # Validate item exists
            item = PricebookItem.find_by(id: item_id)
            unless item
              errors << "Item ID #{item_id} not found"
              next
            end

            # Skip if new_price is invalid
            if new_price <= 0
              errors << "Invalid price for item #{item.item_code}"
              next
            end

            # Get current user from session (if available)
            current_user = nil # TODO: Implement user authentication
            user_name = current_user&.name || "System"

            # Create price history entry
            begin
              PriceHistory.create!(
                pricebook_item_id: item.id,
                old_price: item.current_price,
                new_price: new_price,
                supplier_id: contact.id,
                date_effective: date_effective,
                change_reason: change_reason,
                changed_by_user_id: current_user&.id,
                user_name: user_name
              )

              # Update item's current price if this is the default supplier
              if item.default_supplier_id == contact.id
                item.update!(
                  current_price: new_price,
                  price_last_updated_at: Time.current
                )
              end

              updated_count += 1
            rescue ActiveRecord::RecordInvalid => e
              errors << "Failed to update #{item.item_code}: #{e.message}"
            end
          end
        end

        if errors.any?
          render json: {
            success: false,
            error: "Some prices failed to update",
            errors: errors,
            updated_count: updated_count
          }, status: :unprocessable_entity
        else
          render json: {
            success: true,
            message: "Successfully updated #{updated_count} price#{updated_count == 1 ? '' : 's'}",
            updated_count: updated_count
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
          error: "Failed to bulk update prices: #{e.message}"
        }, status: :internal_server_error
      end

      # DELETE /api/v1/contacts/:id/delete_price_column
      def delete_price_column
        # Handle both nested and top-level params (Rails sometimes nests query params)
        date_effective = params[:date_effective] || params.dig(:params, :date_effective)

        if date_effective.blank?
          return render json: {
            success: false,
            error: "date_effective is required"
          }, status: :bad_request
        end

        contact = Contact.find(params[:id])

        unless contact.is_supplier?
          return render json: {
            success: false,
            error: "Contact must be a supplier"
          }, status: :unprocessable_entity
        end

        deleted_count = 0

        ActiveRecord::Base.transaction do
          # Find all price histories for this supplier with the specific effective date
          price_histories = PriceHistory.where(
            supplier_id: contact.id,
            date_effective: Date.parse(date_effective.to_s)
          )

          deleted_count = price_histories.count
          price_histories.destroy_all
        end

        render json: {
          success: true,
          message: "Successfully deleted #{deleted_count} price #{deleted_count == 1 ? 'history' : 'histories'} for date #{date_effective}",
          deleted_count: deleted_count
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to delete price column: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/validate_abn?abn=12345678901
      def validate_abn
        abn = params[:abn]

        if abn.blank?
          return render json: {
            valid: false,
            error: "ABN is required"
          }
        end

        result = AbnLookupService.validate(abn)
        render json: result
      end

      # GET /api/v1/contacts/:id/activities
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

      # GET /api/v1/contacts/:id/company_group_memberships
      # Returns all corporate group memberships for this contact
      def company_group_memberships
        memberships = @contact.corporate_group_memberships.includes(:corporate_group, :corporate_company)

        render json: {
          success: true,
          data: memberships.map { |m| serialize_membership(m) }
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to load memberships: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/directorships
      # Returns all directorships for this contact (from CorporateCompanyDirector table)
      def directorships
        directorships = @contact.corporate_company_directorships
          .includes(corporate_company: :corporate_group)
          .order(is_current: :desc, appointment_date: :desc)

        render json: {
          success: true,
          data: directorships.map do |d|
            {
              id: d.id,
              company_id: d.company_id,
              company_name: d.corporate_company&.name,
              company_acn: d.corporate_company&.acn,
              company_abn: d.corporate_company&.abn,
              company_status: d.corporate_company&.status,
              company_entity_type: d.corporate_company&.entity_type,
              company_group_id: d.corporate_company&.company_group_id,
              company_group_name: d.corporate_company&.corporate_group&.name,
              position: d.position,
              formatted_position: d.formatted_position,
              appointment_date: d.appointment_date,
              resignation_date: d.resignation_date,
              is_current: d.is_current,
              contact_id: d.contact_id,
              created_at: d.created_at,
              updated_at: d.updated_at
            }
          end
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to load directorships: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/shareholdings
      # Returns all shareholdings for this contact (from CorporateCompanyShareholding table)
      def shareholdings
        shareholdings = @contact.corporate_company_shareholdings
          .includes(corporate_company: :corporate_group)
          .order(created_at: :desc)

        render json: {
          success: true,
          data: shareholdings.map do |s|
            {
              id: s.id,
              company_id: s.company_id,
              company_name: s.corporate_company&.name,
              company_acn: s.corporate_company&.acn,
              company_abn: s.corporate_company&.abn,
              company_status: s.corporate_company&.status,
              company_entity_type: s.corporate_company&.entity_type,
              company_group_id: s.corporate_company&.company_group_id,
              company_group_name: s.corporate_company&.corporate_group&.name,
              share_class: s.share_class,
              number_of_shares: s.number_of_shares,
              percentage_of_total: s.percentage_of_total,
              beneficially_held: s.beneficially_held,
              acquisition_date: s.acquisition_date,
              disposal_date: s.disposal_date,
              consideration_paid: s.consideration_paid,
              created_at: s.created_at,
              updated_at: s.updated_at
            }
          end
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to load shareholdings: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/trust_roles
      # Returns all trust-related roles for this contact (trustee, beneficiary, appointor)
      def trust_roles
        # Get trustee roles (where this contact is trustee of a trust)
        trustee_roles = @contact.outgoing_relationships
          .where(relationship_type: "trustee_of")
          .includes(:related_contact)
          .map do |rel|
            {
              id: rel.id,
              role_type: "trustee",
              trust_id: rel.related_contact_id,
              trust_name: rel.related_contact&.display_name,
              trust_entity_type: rel.related_contact&.entity_type,
              start_date: rel.start_date,
              end_date: rel.end_date,
              is_active: rel.is_active,
              notes: rel.context
            }
          end

        # Get beneficiary roles
        beneficiary_roles = @contact.outgoing_relationships
          .where(relationship_type: "beneficiary_of")
          .includes(:related_contact)
          .map do |rel|
            {
              id: rel.id,
              role_type: "beneficiary",
              trust_id: rel.related_contact_id,
              trust_name: rel.related_contact&.display_name,
              trust_entity_type: rel.related_contact&.entity_type,
              ownership_percentage: rel.ownership_percentage,
              start_date: rel.start_date,
              end_date: rel.end_date,
              is_active: rel.is_active,
              notes: rel.context
            }
          end

        # Get appointor roles
        appointor_roles = @contact.outgoing_relationships
          .where(relationship_type: "appointor_of")
          .includes(:related_contact)
          .map do |rel|
            {
              id: rel.id,
              role_type: "appointor",
              trust_id: rel.related_contact_id,
              trust_name: rel.related_contact&.display_name,
              trust_entity_type: rel.related_contact&.entity_type,
              start_date: rel.start_date,
              end_date: rel.end_date,
              is_active: rel.is_active,
              notes: rel.context
            }
          end

        render json: {
          success: true,
          data: {
            trustee_roles: trustee_roles,
            beneficiary_roles: beneficiary_roles,
            appointor_roles: appointor_roles,
            total_count: trustee_roles.length + beneficiary_roles.length + appointor_roles.length
          }
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to load trust roles: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/ownership_chain
      # Returns the full ownership chain showing what companies this person owns
      # and what those companies own (including trusts)
      def ownership_chain
        # Get direct shareholdings for this contact
        direct_holdings = @contact.corporate_company_shareholdings
          .includes(corporate_company: [ :corporate_group ])
          .where("number_of_shares > 0")

        chain = direct_holdings.map do |holding|
          percentage = holding.percentage_of_total
          next nil if percentage <= 0
          build_ownership_node(holding.corporate_company, percentage)
        end.compact

        render json: {
          success: true,
          data: chain
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to load ownership chain: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/possible_duplicates
      # Find contacts that might be duplicates based on name matching
      def possible_duplicates
        duplicates = []

        # Find contacts with similar display_name (case insensitive, ignoring extra whitespace)
        # Group by normalized name
        contacts_by_name = Contact.all
          .group_by { |c| normalize_name(c.display_name) }

        contacts_by_name.each do |normalized_name, contacts|
          next if normalized_name.blank?
          next if contacts.size < 2

          # This is a potential duplicate group
          duplicates << {
            match_type: "display_name",
            match_value: normalized_name,
            contacts: contacts.map { |c| contact_duplicate_json(c) }
          }
        end

        # Also check for first_name + last_name combinations that match
        contacts_by_first_last = Contact.all
          .where.not(first_name: [ nil, "" ])
          .where.not(last_name: [ nil, "" ])
          .group_by { |c| "#{normalize_name(c.first_name)}|#{normalize_name(c.last_name)}" }

        contacts_by_first_last.each do |name_key, contacts|
          next if name_key.blank? || name_key == "|"
          next if contacts.size < 2

          # Check if we already have this group from display_name matching
          first_ids = contacts.map(&:id).sort
          already_found = duplicates.any? do |d|
            d[:contacts].map { |c| c[:id] }.sort == first_ids
          end
          next if already_found

          duplicates << {
            match_type: "first_last_name",
            match_value: name_key.gsub("|", " "),
            contacts: contacts.map { |c| contact_duplicate_json(c) }
          }
        end

        # Check for same email (different contacts with same email)
        contacts_by_email = Contact.all
          .where.not(email: [ nil, "" ])
          .group_by { |c| c.email&.downcase&.strip }

        contacts_by_email.each do |email, contacts|
          next if email.blank?
          next if contacts.size < 2

          # Check if we already have this group
          email_ids = contacts.map(&:id).sort
          already_found = duplicates.any? do |d|
            d[:contacts].map { |c| c[:id] }.sort == email_ids
          end
          next if already_found

          duplicates << {
            match_type: "email",
            match_value: email,
            contacts: contacts.map { |c| contact_duplicate_json(c) }
          }
        end

        # Sort by number of potential duplicates (most first)
        duplicates.sort_by! { |d| -d[:contacts].size }

        render json: {
          success: true,
          total_duplicate_groups: duplicates.size,
          total_contacts_involved: duplicates.sum { |d| d[:contacts].size },
          duplicates: duplicates
        }
      rescue => e
        Rails.logger.error("Possible duplicates error: #{e.message}")
        render json: {
          success: false,
          error: "Failed to find possible duplicates: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/entity_types
      # SSoT: Returns valid entity types from Contact::ENTITY_TYPES
      # Frontend should use this instead of hardcoding entity types
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

      # GET /api/v1/contacts/price_only_with_xero
      # Health check: Find price_only contacts that are synced to Xero (should never happen)
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

      # GET /api/v1/contacts/company_with_first_name
      # Health check: Find companies/trusts/price_only with first_name or last_name set
      def company_with_first_name
        violations = Contact.where(entity_type: [ "company", "trust", "price_only" ])
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

      # GET /api/v1/contacts/person_without_name
      # Health check: Find person/sole_trader contacts without first_name
      def person_without_name
        violations = Contact.where(entity_type: [ "person", "sole_trader" ])
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

      # GET /api/v1/contacts/missing_contact_info
      # Health check: Find contacts (excluding price_only) without mobile or email
      def missing_contact_info
        begin
          # Exclude price_only - they're just pricebook placeholders
          violations = Contact.where.not(entity_type: "price_only")
            .where("(mobile_phone IS NULL OR mobile_phone = '') AND (email IS NULL OR email = ''")

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
      end

      # GET /api/v1/contacts/connected_mailboxes
      # Returns list of users with connected Outlook mailboxes for employee extraction
      def connected_mailboxes
        users_with_outlook = User.joins(:outlook_credential)
          .select("users.id, users.name, users.email, user_outlook_credentials.email as outlook_email")

        render json: {
          success: true,
          mailboxes: users_with_outlook.map { |u|
            {
              user_id: u.id,
              user_name: u.name,
              email: u.outlook_email || u.email
            }
          }
        }
      rescue => e
        Rails.logger.error("Connected mailboxes error: #{e.message}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/contacts/health
      # Quick health score for header display
      def health
        begin
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
      end

      # GET /api/v1/contacts/preview_employee_extraction
      # Preview what would be extracted from email warehouse for specified email addresses
      # New flow:
      # 1. Search email warehouse for emails involving specified addresses
      # 2. For each unique email, find matching EXISTING contacts by fuzzy name match
      # 3. Show option to add email to existing contact
      # 4. Create relationships to BOTH parent company AND email domain company
      def preview_employee_extraction
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
        base_query = EmailWarehouse.involving_email(email_patterns)

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
            bodies = EmailWarehouse.where("LOWER(from_email) = ?", sender)
              .where.not(body_text: nil)
              .order(received_at: :desc)
              .limit(3)
              .pluck(:body_text)

            email_bodies[sender] = bodies if bodies.any?
          end
        end

        # Filter out generic/system emails
        generic_patterns = [ "noreply", "no-reply", "donotreply", "postmaster", "mailer-daemon", "accounts@", "info@", "support@", "admin@" ]
        candidate_emails = unique_emails.reject do |email_addr|
          generic_patterns.any? { |pattern| email_addr.downcase.include?(pattern) }
        end

        # Build preview data for each unique email address
        preview_data = candidate_emails.filter_map do |email_addr|
          # Extract person name from email (e.g., "sophie.harder" -> "Sophie Harder")
          email_local = email_addr.split("@").first
          person_name_from_email = email_local.split(/[._-]/).map(&:capitalize).join(" ")

          # Check if this email already exists on any contact
          contact_with_email = Contact.find_by(email: email_addr)

          # Search for potential matching contacts by name match
          # STRICT matching rules:
          # 1. Single name (e.g., "andrew") - no matches, too ambiguous
          # 2. First name + single initial (e.g., "Justin S") - require initial to match START of last name
          # 3. First name + full last name (e.g., "Sophie Harder") - standard matching
          name_parts = person_name_from_email.downcase.split(" ")

          matching_contacts = if name_parts.length < 2
            # Single name part only (e.g., "andrew@tekna.com.au")
            # Don't match - too ambiguous. Can't determine which "Andrew" is correct.
            Contact.none
          elsif name_parts.any? { |p| p.length == 1 }
            # Has a single-letter initial (e.g., "Justin S" -> ["justin", "s"])
            # This is too ambiguous - "Justin S" could be Stevens, Smith, Saunders, etc.
            # We CANNOT reliably match this to an existing contact.
            # User should create a new contact instead.
            Contact.none
          elsif name_parts.any? { |p| p.length == 2 }
            # Has a very short name part (e.g., "Justin St" -> ["justin", "st"])
            # Still too ambiguous - could match many last names
            Contact.none
          else
            # Multiple full name parts (3+ chars each): require ALL parts to be present (AND logic)
            # e.g., "Sophie Harder" matches "Sophie Harder" and "Sophie Mee-jeong Harder"
            Contact.where(entity_type: "person")
              .where(name_parts.map { "LOWER(display_name) ILIKE ?" }.join(" AND "), *name_parts.map { |p| "%#{p}%" })
              .limit(5)
          end

          # Get email domain company (skip personal email providers)
          domain = email_addr.split("@").last.downcase

          # Personal email domain patterns - match base name regardless of TLD
          personal_domain_bases = %w[
            gmail googlemail hotmail outlook live msn
            yahoo ymail icloud me mac
            aol protonmail proton zoho mail inbox
            bigpond optusnet
          ]

          # Check if domain matches any personal email pattern (e.g., outlook.com, outlook.com.au, hotmail.co.uk)
          domain_base = domain.split(".").first
          is_personal_domain = personal_domain_bases.include?(domain_base)

          domain_company = nil
          domain_company_name = nil

          unless is_personal_domain
            # For subdomains like "au.harveynorman.com", extract the main company name
            # Split by dots and find the most meaningful part (not "au", "com", etc.)
            domain_parts = domain.split(".")
            tlds_and_country_codes = %w[com net org edu gov au uk nz us ca co]
            meaningful_parts = domain_parts.reject { |p| tlds_and_country_codes.include?(p.downcase) || p.length <= 2 }
            domain_company_name = (meaningful_parts.first || domain_parts.first).titleize

            # FIRST: Try to match by domain name (the email domain is the best indicator of employer)
            # IMPORTANT: Prioritize display_name matches over company_name_or_trust to avoid false matches
            # (e.g., contact might have incorrect data in company_name_or_trust field)

            # Step 1: Try exact-ish match on display_name first
            domain_company = Contact.where(entity_type: [ "company", "trust", "sole_trader" ])
              .where("LOWER(display_name) LIKE ?", "%#{domain_company_name.downcase}%")
              .first

            # Step 2: If no display_name match, try with spaces removed on display_name
            if domain_company.nil?
              domain_company = Contact.where(entity_type: [ "company", "trust", "sole_trader" ])
                .where("LOWER(REPLACE(display_name, ' ', '')) LIKE ?",
                       "%#{domain_company_name.downcase.gsub(' ', '')}%")
                .first
            end

            # Step 3: Only fall back to company_name_or_trust if no display_name match
            # (company_name_or_trust can have stale/incorrect data)
            if domain_company.nil?
              domain_company = Contact.where(entity_type: [ "company", "trust", "sole_trader" ])
                .where("LOWER(company_name_or_trust) LIKE ?", "%#{domain_company_name.downcase}%")
                .first
            end

            # If no match and domain looks like an abbreviation (2-4 uppercase letters like SVP),
            # try matching the first letters of each word in company names
            # e.g., "SVP" matches "SV Partners" (S-V from first two words)
            if domain_company.nil? && domain_company_name.length <= 5
              abbrev = domain_company_name.upcase
              domain_company = Contact.where(entity_type: [ "company", "trust", "sole_trader" ])
                .where("UPPER(display_name) LIKE ?", "#{abbrev[0..1]}%")
                .first
            end

            # FALLBACK: If no domain match, check if the matched contact has an existing company relationship
            # This handles edge cases where the company name doesn't match the domain
            if domain_company.nil?
              first_match = matching_contacts.first
              if first_match&.primary_company_id
                domain_company = Contact.find_by(id: first_match.primary_company_id)
              end

              # Also check for employee_of relationships
              if domain_company.nil? && first_match
                employee_rel = ContactRelationship.find_by(
                  source_contact_id: first_match.id,
                  relationship_type: "employee_of"
                )
                domain_company = Contact.find_by(id: employee_rel&.related_contact_id)
              end
            end
          end

          # Get parent companies this email was found communicating with
          # These are companies the person has communicated with (like suppliers/clients)
          # ONLY hide these for personal email domains (gmail users aren't employees just because they emailed a company)
          # But DO show them when we have a domain company - they're still valid relationship options
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
            # The email we found
            email: email_addr,
            person_name_from_email: person_name_from_email,

            # Whether this email is already on a contact
            email_exists_on_contact: contact_with_email.present?,
            existing_contact_with_email: contact_with_email ? {
              id: contact_with_email.id,
              display_name: contact_with_email.display_name,
              entity_type: contact_with_email.entity_type
            } : nil,

            # Matching contacts we could add this email to
            matching_contacts: matching_contacts.map { |c|
              {
                id: c.id,
                display_name: c.display_name,
                email: c.email,
                mobile_phone: c.mobile_phone,
                office_phone: c.office_phone, # Direct line for person
                entity_type: c.entity_type,
                xero_contact_type: c.xero_contact_types&.first, # CUSTOMER, SUPPLIER, or nil - helps determine if this is an employee or client
                xero_invoice_count: c.xero_invoice_count, # If > 0, likely a customer
                # Check if relationships already exist
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

            # The company derived from email domain (e.g., Tekna from @tekna.com.au)
            # For personal email domains (gmail, hotmail, etc.), don't suggest any company
            domain_company: if domain_company
              {
                id: domain_company.id,
                name: domain_company.display_name,
                entity_type: domain_company.entity_type,
                office_phone: domain_company.office_phone,
                website: domain_company.website,
                exists: true
              }
                            elsif domain_company_name.present? && !is_personal_domain
              # Only suggest creating a company for non-personal domains
              {
                id: nil,
                name: domain_company_name,
                entity_type: "company",
                office_phone: nil,
                website: nil,
                exists: false
              }
                            else
              # Personal email domain - don't suggest any company
              nil
                            end,

            # Parent companies this person was communicating with
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

            # Phone numbers extracted from signature
            phones: phones
          }
        end

        # Filter to only show items where we have matching contacts
        preview_data = preview_data.select { |item| item[:matching_contacts].any? }

        # Filter out "perfect matches" that have nothing to update
        # A perfect match with nothing to update = single contact match + email matches + employer linked + no phones to add
        preview_data = preview_data.reject do |item|
          next false if item[:matching_contacts].length != 1

          contact = item[:matching_contacts].first
          phones = item[:phones] || {}
          domain_company = item[:domain_company]

          email_matches = contact[:email]&.downcase == item[:email].downcase
          employer_linked = contact[:relationship_to_domain_company_exists]

          # Check if there are any phones we could add
          can_add_mobile = phones[:mobile].present? && contact[:mobile_phone].blank?
          can_add_direct = phones[:direct].present? && contact[:office_phone].blank?
          can_add_office_to_company = phones[:office].present? && domain_company && domain_company[:exists] && domain_company[:office_phone].blank?

          has_something_to_update = can_add_mobile || can_add_direct || can_add_office_to_company || !email_matches || !employer_linked

          # Skip if: nothing to update
          !has_something_to_update
        end

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

      # POST /api/v1/contacts/extract_employees
      # Execute employee extraction based on confirmation data
      # Creates ContactRelationship records (not ContactEmployment)
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
                # Could add to secondary email field if available
                # For now, just log
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

      # GET /api/v1/contacts/:id/case_relationships
      # Returns all cases this contact has been involved in with relationship details
      def case_relationships
        relationships = @contact.case_relationships

        render json: {
          success: true,
          data: relationships,
          total_count: relationships.length
        }
      rescue => e
        Rails.logger.error("Case relationships error: #{e.message}")
        render json: {
          success: false,
          error: "Failed to load case relationships: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/coworkers
      # Returns other people who work at the same company(ies) as this contact
      # For person contacts: finds people at the same company via employee_of relationships
      # For company contacts: finds all employees/directors/shareholders of this company
      def coworkers
        coworkers_data = []

        if @contact.entity_type == "person" || @contact.entity_type == "sole_trader"
          # Get all companies this person works at
          company_ids = @contact.outgoing_relationships
            .active
            .where(relationship_type: %w[employee_of director_of shareholder_of])
            .pluck(:related_contact_id)

          # Find other people at these companies
          if company_ids.any?
            coworkers = Contact.joins(:outgoing_relationships)
              .where(contact_relationships: {
                related_contact_id: company_ids,
                relationship_type: %w[employee_of director_of shareholder_of],
                is_active: true
              })
              .where.not(id: @contact.id)
              .where(entity_type: %w[person sole_trader])
              .distinct
              .includes(:outgoing_relationships)

            coworkers_data = coworkers.map do |coworker|
              # Get their roles at the shared companies
              shared_roles = coworker.outgoing_relationships
                .active
                .where(related_contact_id: company_ids)
                .includes(:related_contact)
                .map do |rel|
                  {
                    company_id: rel.related_contact_id,
                    company_name: rel.related_contact&.display_name,
                    role: rel.relationship_type.gsub("_of", "").gsub("_", " ").titleize
                  }
                end

              {
                id: coworker.id,
                display_name: coworker.display_name,
                email: coworker.email,
                mobile_phone: coworker.mobile_phone,
                entity_type: coworker.entity_type,
                company_roles: shared_roles
              }
            end
          end
        else
          # This is a company - find all people associated with it
          coworkers = Contact.joins(:outgoing_relationships)
            .where(contact_relationships: {
              related_contact_id: @contact.id,
              relationship_type: %w[employee_of director_of shareholder_of],
              is_active: true
            })
            .where(entity_type: %w[person sole_trader])
            .distinct
            .includes(:outgoing_relationships)

          coworkers_data = coworkers.map do |person|
            # Get their role at this company
            roles = person.outgoing_relationships
              .active
              .where(related_contact_id: @contact.id)
              .pluck(:relationship_type)
              .map { |rt| rt.gsub("_of", "").gsub("_", " ").titleize }

            {
              id: person.id,
              display_name: person.display_name,
              email: person.email,
              mobile_phone: person.mobile_phone,
              entity_type: person.entity_type,
              roles: roles
            }
          end
        end

        render json: {
          success: true,
          data: coworkers_data,
          total_count: coworkers_data.length
        }
      rescue => e
        Rails.logger.error("Coworkers error: #{e.message}")
        render json: {
          success: false,
          error: "Failed to load coworkers: #{e.message}"
        }, status: :internal_server_error
      end

      # ========================================
      # QUALITY REVIEW ENDPOINTS
      # ========================================

      # GET /api/v1/contacts/quality_reviews
      # Returns the review queue with filtering options
      def quality_reviews
        reviews = ContactQualityReview.includes(:contact, :suggested_company)
                                      .order(confidence_score: :desc, created_at: :desc)

        # Filter by status (default: pending)
        status = params[:status] || "pending"
        reviews = reviews.where(status: status) unless status == "all"

        # Filter by issue_type if provided
        reviews = reviews.by_issue_type(params[:issue_type]) if params[:issue_type].present?

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i
        total_count = reviews.count
        reviews = reviews.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: reviews.map { |r| format_quality_review(r) },
          total_count: total_count,
          page: page,
          per_page: per_page,
          by_issue_type: ContactQualityReview.where(status: status == "all" ? ContactQualityReview::STATUSES : status)
                                             .group(:issue_type)
                                             .count,
          by_status: ContactQualityReview.group(:status).count
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contacts/quality_scan
      # Run the detection scan and populate review queue
      def quality_scan
        # Run scan synchronously for now (could be background job for large datasets)
        scan_results = run_quality_scan

        render json: {
          success: true,
          message: "Quality scan completed",
          results: scan_results
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contact_quality_reviews/:id/approve
      # Approve and execute the recommended action
      def approve_quality_review
        review = ContactQualityReview.find(params[:id])

        if review.reviewed?
          return render json: {
            success: false,
            error: "Review has already been processed"
          }, status: :unprocessable_entity
        end

        ActiveRecord::Base.transaction do
          # Execute the action
          ContactQualityActionService.new(review).execute!

          # Mark as approved
          review.approve!(current_user, notes: params[:notes])
        end

        render json: {
          success: true,
          data: format_quality_review(review.reload)
        }
      rescue ContactQualityActionService::ActionError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contact_quality_reviews/:id/reject
      # Reject the review (no action taken)
      def reject_quality_review
        review = ContactQualityReview.find(params[:id])

        if review.reviewed?
          return render json: {
            success: false,
            error: "Review has already been processed"
          }, status: :unprocessable_entity
        end

        review.reject!(current_user, notes: params[:notes])

        render json: {
          success: true,
          data: format_quality_review(review)
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contact_quality_reviews/:id/skip
      # Skip the review for now
      def skip_quality_review
        review = ContactQualityReview.find(params[:id])

        if review.reviewed?
          return render json: {
            success: false,
            error: "Review has already been processed"
          }, status: :unprocessable_entity
        end

        review.skip!(current_user, notes: params[:notes])

        render json: {
          success: true,
          data: format_quality_review(review)
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contact_quality_reviews/bulk_approve
      # Approve multiple high-confidence reviews
      def bulk_approve_quality_reviews
        review_ids = params[:review_ids]
        min_confidence = (params[:min_confidence] || 80).to_i

        unless review_ids.is_a?(Array) && review_ids.any?
          return render json: {
            success: false,
            error: "review_ids array is required"
          }, status: :bad_request
        end

        results = { approved: 0, failed: 0, errors: [] }

        ContactQualityReview.where(id: review_ids, status: "pending")
                           .where("confidence_score >= ?", min_confidence)
                           .find_each do |review|
          begin
            ActiveRecord::Base.transaction do
              ContactQualityActionService.new(review).execute!
              review.approve!(current_user, notes: "Bulk approved")
            end
            results[:approved] += 1
          rescue => e
            results[:failed] += 1
            results[:errors] << { review_id: review.id, error: e.message }
          end
        end

        render json: {
          success: true,
          results: results
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contacts/:id/verify_abn
      # Verify ABN via ABR and update contact
      def verify_abn
        contact = Contact.find(params[:id])

        if contact.tax_number.blank?
          return render json: {
            success: false,
            error: "Contact has no ABN/tax number"
          }, status: :unprocessable_entity
        end

        result = contact.verify_abn!

        render json: {
          success: true,
          data: {
            abn: contact.tax_number,
            abn_formatted: AbrApiService.format(contact.tax_number),
            entity_name: result[:entity_name],
            entity_type: result[:entity_type_description],
            entity_type_code: result[:entity_type_code],
            gst_registered: result[:gst_registered],
            valid: result[:valid],
            active: result[:active]
          }
        }
      rescue AbrApiService::AbrError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/contacts/:id/analyze_quality
      # Analyze a single contact for quality issues
      def analyze_quality
        contact = Contact.find(params[:id])
        service = ContactDataQualityService.new(contact)
        analysis = service.analyze

        render json: {
          success: true,
          data: analysis
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/contacts/find_missing_abns
      # Find and populate missing ABNs by searching company names via ABR API
      def find_missing_abns
        unless ENV["ABR_GUID"].present?
          render json: {
            success: false,
            error: "ABR_GUID environment variable not set. Register at https://abr.business.gov.au"
          }, status: :service_unavailable
          return
        end

        # Run the task in the background using Solid Queue
        FindMissingAbnsJob.perform_later

        render json: {
          success: true,
          message: "ABN search started in background. This may take several minutes."
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      private

      # Format a quality review for API response
      def format_quality_review(review)
        {
          id: review.id,
          contact_id: review.contact_id,
          contact: {
            id: review.contact.id,
            display_name: review.contact.display_name,
            email: review.contact.email,
            entity_type: review.contact.entity_type,
            tax_number: review.contact.tax_number
          },
          suggested_company: review.suggested_company ? {
            id: review.suggested_company.id,
            display_name: review.suggested_company.display_name,
            email: review.suggested_company.email,
            entity_type: review.suggested_company.entity_type
          } : nil,
          issue_type: review.issue_type,
          issue_type_label: review.issue_type_label,
          status: review.status,
          recommended_action: review.recommended_action,
          recommended_action_label: review.recommended_action_label,
          confidence_score: review.confidence_score,
          email_domain: review.email_domain,
          derived_company_name: review.derived_company_name,
          abr_data: review.abr_data,
          analysis_data: review.analysis_data,
          review_notes: review.review_notes,
          reviewed_by_id: review.reviewed_by_id,
          reviewed_at: review.reviewed_at,
          created_at: review.created_at,
          updated_at: review.updated_at
        }
      end

      # Run the quality scan and populate review queue
      def run_quality_scan
        results = { scanned: 0, issues_found: 0, by_issue_type: {} }

        # Clear stale pending reviews (older than 30 days)
        ContactQualityReview.pending.where("created_at < ?", 30.days.ago).destroy_all

        Contact.find_each do |contact|
          results[:scanned] += 1

          begin
            service = ContactDataQualityService.new(contact)
            analysis = service.analyze

            if analysis[:recommended_action] != :no_action && analysis[:issues].any?
              issue_type = analysis[:issues].first[:type] || "unknown"

              review = ContactQualityReview.find_or_initialize_by(
                contact: contact,
                issue_type: issue_type
              )

              # Only update if pending or new
              if review.new_record? || review.status == "pending"
                review.assign_attributes(
                  suggested_company_id: analysis[:existing_company_match]&.id,
                  recommended_action: analysis[:recommended_action].to_s,
                  confidence_score: analysis[:confidence],
                  analysis_data: analysis,
                  abr_data: analysis[:abr_data],
                  email_domain: analysis[:domain_analysis]&.dig(:domain),
                  derived_company_name: analysis[:domain_analysis]&.dig(:derived_company_name),
                  status: "pending"
                )
                review.save!

                results[:issues_found] += 1
                results[:by_issue_type][issue_type] ||= 0
                results[:by_issue_type][issue_type] += 1
              end
            end
          rescue StandardError => e
            Rails.logger.error "Quality scan error for contact #{contact.id}: #{e.message}"
          end
        end

        results
      end

      # SSoT: Require corporate permission to access director/shareholder data
      def require_corporate_permission
        unless can_view_corporate?
          render json: {
            success: false,
            error: "You do not have permission to view corporate data"
          }, status: :forbidden
        end
      end

      # Convert name to Title Case while handling special cases
      # - "JOHN" -> "John"
      # - "john" -> "John"
      # - "mcdonald" -> "Mcdonald" (simple titleize, not perfect for all edge cases)
      # - "O'BRIEN" -> "O'Brien"
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

      # Merge a duplicate contact into the primary contact
      # - Moves relationships from duplicate to primary
      # - Copies any missing data (email, mobile, etc.)
      # - Soft deletes the duplicate
      def merge_contact_into(primary, duplicate)
        return if primary.id == duplicate.id

        Rails.logger.info("Merging contact #{duplicate.id} (#{duplicate.display_name}) into #{primary.id} (#{primary.display_name})")

        # Copy missing contact info from duplicate to primary
        primary.email ||= duplicate.email
        primary.mobile_phone ||= duplicate.mobile_phone
        primary.office_phone ||= duplicate.office_phone
        primary.first_name ||= duplicate.first_name
        primary.last_name ||= duplicate.last_name
        primary.save! if primary.changed?

        # Move outgoing relationships (where duplicate is source)
        duplicate.outgoing_relationships.each do |rel|
          # Skip if primary already has this relationship
          next if ContactRelationship.exists?(
            source_contact_id: primary.id,
            related_contact_id: rel.related_contact_id
          )

          # Update the relationship to point to primary
          rel.update!(source_contact_id: primary.id)
        end

        # Move incoming relationships (where duplicate is target)
        duplicate.incoming_relationships.each do |rel|
          # Skip if primary already has this relationship
          next if ContactRelationship.exists?(
            source_contact_id: rel.source_contact_id,
            related_contact_id: primary.id
          )

          # Update the relationship to point to primary
          rel.update!(related_contact_id: primary.id)
        end

        # Transfer Xero links from duplicate to primary
        duplicate.xero_links.each do |xero_link|
          # Check if primary already has a link to this Xero tenant
          existing = primary.xero_links.find_by(
            tenant_id: xero_link.tenant_id,
            source: xero_link.source
          )

          if existing
            # Check if they point to different Xero contacts
            if xero_link.external_contact_id != existing.external_contact_id
              # Different Xero contact IDs - one is stale, transfer it and mark as stale
              xero_link.mark_stale!('not_found')
              xero_link.update!(
                contact_id: primary.id,
                sync_error: "Contact merged - duplicate Xero link marked as stale"
              )
              Rails.logger.info("[ContactMerge] Transferred stale Xero link: #{xero_link.external_contact_id}")
            else
              # Same Xero contact ID - true duplicate, safe to skip (will be destroyed with contact)
              Rails.logger.info("[ContactMerge] Skipping duplicate Xero link to #{xero_link.tenant_name}")
            end
          else
            # Transfer this Xero link to primary
            xero_link.update!(contact_id: primary.id)
            Rails.logger.info("[ContactMerge] Transferred Xero link to #{xero_link.tenant_name}")
          end
        end

        # Soft delete the duplicate contact
        duplicate.update!(is_active: false)

        Rails.logger.info("Merged and deleted duplicate contact #{duplicate.id}")
      end

      # Extract phone numbers from email signature text
      # Returns { mobile:, office:, direct: } hash
      def extract_phones_from_signatures(bodies)
        return {} if bodies.blank?

        phones = { mobile: nil, office: nil, direct: nil }

        bodies.each do |body|
          next if body.blank?

          # Extract signature (text after common signature delimiters)
          signature = extract_signature_from_text(body)
          next if signature.blank?

          # Australian mobile pattern: 04XX XXX XXX or +61 4XX XXX XXX
          mobile_patterns = [
            /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/i,
            /(?:Mobile|Mob|M)[:\s]*(04\d{2}\s?\d{3}\s?\d{3})/i,
            /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{8})/i,
            /(?:Mobile|Mob|M)[:\s]*(04\d{8})/i,
            /(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/,
            /(04\d{2}\s?\d{3}\s?\d{3})/
          ]

          # Office/landline pattern: (0X) XXXX XXXX or +61 X XXXX XXXX
          office_patterns = [
            /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
            /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
            /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
            /(\+61\s?\d{1}\s?\d{4}\s?\d{4})/,
            /(\(0\d\)\s?\d{4}\s?\d{4})/,
            /(0\d\s?\d{4}\s?\d{4})/
          ]

          # Direct line pattern (including 1800/1300 numbers)
          direct_patterns = [
            /(?:Direct|Dir|D)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
            /(?:Direct|Dir|D)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
            /(?:Direct|Dir|D)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
            /(?:Direct|Dir|D)[:\s]*(1800\s?\d{3}\s?\d{3})/i,
            /(?:Direct|Dir|D)[:\s]*(1300\s?\d{3}\s?\d{3})/i
          ]

          # Try to extract mobile first
          mobile_patterns.each do |pattern|
            match = signature.match(pattern)
            if match && match[1]
              phones[:mobile] ||= normalize_phone_number(match[1])
              break if phones[:mobile]
            end
          end

          # Try to extract direct BEFORE office (so "D:" lines aren't matched by office patterns)
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

          # Try to extract office last
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

          # Stop if we found at least a mobile
          break if phones[:mobile].present?
        end

        phones.compact
      end

      # Extract signature portion from email text (only the sender's signature, not quoted replies)
      def extract_signature_from_text(text)
        # First, remove any quoted reply content
        # Common patterns that indicate start of quoted content
        quote_indicators = [
          /\n[-]+\s*Original Message\s*[-]+/i,   # ----- Original Message -----
          /\nFrom:\s*[^\n]+\nSent:/i,             # From: xxx \n Sent:
          /\nOn\s+.+wrote:/i,                     # On Mon, Jan 5, 2023 wrote:
          /\n>+/,                                  # > quoted lines
          /\n_{10,}/                               # ______________ separator
        ]

        # Truncate at first quote indicator
        clean_text = text.dup
        quote_indicators.each do |indicator|
          if (match = clean_text.match(indicator))
            clean_text = clean_text[0...match.begin(0)]
          end
        end

        # Now find signature in the clean text
        signature_delimiters = [
          /\n--\s*\n/,           # Standard "-- " delimiter
          /\nRegards,?\n/i,      # "Regards,"
          /\nBest regards,?\n/i, # "Best regards,"
          /\nThanks,?\n/i,       # "Thanks,"
          /\nCheers,?\n/i,       # "Cheers,"
          /\nKind regards,?\n/i  # "Kind regards,"
        ]

        signature_delimiters.each do |delimiter|
          if clean_text.match(delimiter)
            parts = clean_text.split(delimiter, 2)
            if parts.length > 1
              # Return up to 20 lines of signature
              sig_lines = parts[1].split("\n").first(20)
              return sig_lines.join("\n")
            end
          end
        end

        # If no delimiter found, try to get last 15 lines of clean text
        lines = clean_text.split("\n")
        lines.last(15).join("\n")
      end

      # Normalize phone number to consistent format
      def normalize_phone_number(phone)
        return nil if phone.blank?
        clean = phone.gsub(/[^\d+]/, "")
        if clean.start_with?("+61")
          clean = "0" + clean[3..]
        end
        clean
      end

      def normalize_name(name)
        return nil if name.blank?
        name.to_s.downcase.gsub(/\s+/, " ").strip
      end

      def serialize_membership(membership)
        {
          id: membership.id,
          contact_id: membership.contact_id,
          company_group_id: membership.company_group_id,
          company_group_name: membership.corporate_group&.name,
          membership_type: membership.membership_type,
          company_id: membership.company_id,
          company_name: membership.corporate_company&.name,
          can_view_confidential: membership.can_view_confidential,
          can_edit: membership.can_edit,
          is_active: membership.is_active
        }
      end

      # Find all contact IDs that are possible duplicates (share normalized name with another contact)
      def find_duplicate_contact_ids
        contacts_by_name = Contact.all
          .group_by { |c| normalize_name(c.display_name) }

        duplicate_ids = []
        contacts_by_name.each do |normalized_name, contacts|
          next if normalized_name.blank?
          next if contacts.size < 2
          duplicate_ids.concat(contacts.map(&:id))
        end
        duplicate_ids
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

      # Build ownership node recursively for ownership_chain endpoint
      def build_ownership_node(company, percentage, visited = Set.new)
        return nil if company.nil? || visited.include?(company.id)
        visited.add(company.id)

        # Get companies this company owns shares in
        child_holdings = CorporateCompanyShareholding
          .where(shareholder_type: "Company", shareholder_id: company.id)
          .where("number_of_shares > 0")
          .includes(corporate_company: [ :corporate_group ])

        children = child_holdings.map do |holding|
          child_percentage = holding.percentage_of_total
          next nil if child_percentage <= 0
          build_ownership_node(holding.corporate_company, child_percentage, visited)
        end.compact

        # Check if this company is a trustee
        trust_entity = nil
        if company.is_trustee && company.trust_name.present?
          trust_entity = CorporateCompany.where(entity_type: [ "Trust", "Superfund" ]).find_by(name: company.trust_name)
        end

        {
          company_id: company.id,
          company_name: company.name,
          percentage: percentage,
          entity_type: company.entity_type,
          is_trustee: company.is_trustee,
          trust_name: company.trust_name,
          trust_id: trust_entity&.id,
          trust_entity_type: trust_entity&.entity_type,
          children: children
        }
      end

      def set_contact
        id_or_slug = params[:id]

        if id_or_slug.to_s.match?(/\A\d+\z/)
          # Numeric ID - direct lookup
          @contact = Contact.find(id_or_slug)
        else
          # Slug - search by name (convert slug back to search term)
          # Remove the _God_Loves_You_ suffix if present
          slug = id_or_slug.to_s.gsub(/_God_Loves_You_$/i, "")
          search_term = slug.gsub("-", " ")

          # Try exact substring match first
          @contact = Contact.where("LOWER(display_name) LIKE ?", "%#{search_term.downcase}%").first

          # If not found, try matching all words (handles middle names)
          # e.g., "rachel harder" should match "Rachel Anne Harder"
          unless @contact
            words = search_term.downcase.split(/\s+/).reject(&:blank?)
            if words.any?
              conditions = words.map { |w| "LOWER(display_name) LIKE '%#{Contact.sanitize_sql_like(w)}%'" }.join(" AND ")
              @contact = Contact.where(conditions).first
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
          :fax_phone,
          :website,
          :tax_number,
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
    end
  end
end
