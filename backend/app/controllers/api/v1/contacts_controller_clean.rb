# frozen_string_literal: true

module Api
  module V1
    class ContactsController < ApplicationController
      before_action :set_contact, only: [:show, :update, :destroy, :activities, :internal_messages]

      def read_only_fields
        render json: {
          success: true,
          read_only_fields: Contact::XERO_READ_ONLY_FIELDS,
          message: "These fields are synced from Xero and cannot be edited in TEEEM"
        }
      end

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
        # SSoT: Supports search_mode parameter (contains, exact, starts_with)
        if params[:search].present?
          search_mode = params[:search_mode] || 'contains'
          search_term = case search_mode
                        when 'exact' then params[:search]
                        when 'starts_with' then "#{params[:search]}%"
                        else "%#{params[:search]}%" # contains (default)
                        end

          # Build WHERE clause based on mode
          ilike_op = search_mode == 'exact' ? '=' : 'ILIKE'
          search_sql = if search_mode == 'exact'
            "LOWER(contacts.display_name) = LOWER(:q) OR
             LOWER(contacts.email) = LOWER(:q) OR
             LOWER(contacts.first_name) = LOWER(:q) OR
             LOWER(contacts.last_name) = LOWER(:q) OR
             (contacts.is_team_contact = true AND LOWER(primary_companies_contacts.display_name) = LOWER(:q))"
          else
            "contacts.display_name ILIKE :q OR
             contacts.email ILIKE :q OR
             contacts.first_name ILIKE :q OR
             contacts.last_name ILIKE :q OR
             (contacts.is_team_contact = true AND primary_companies_contacts.display_name ILIKE :q)"
          end

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

      def create
        @contact = Contact.new(contact_params)

        if @contact.save
          render json: { success: true, contact: @contact }, status: :created
        else
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

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

      def match_supplier
        render json: {
          success: false,
          error: "This endpoint is deprecated. Suppliers are now managed directly as contacts with type='supplier'."
        }, status: :gone
      end

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
        eager_load_associations = if action_name == "show"
          [:contact_emails, :contact_phones, :contact_persons, :contact_addresses,
           :contact_groups, :portal_user, :corporate_group]
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
end
