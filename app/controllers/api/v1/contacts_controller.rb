module Api
  module V1
    class ContactsController < ApplicationController
      before_action :set_contact, only: [:show, :update, :destroy, :activities, :link_xero_contact, :create_portal_user, :update_portal_user, :delete_portal_user, :internal_messages]

      # GET /api/v1/contacts
      def index
        @contacts = Contact.all

        # Search by name or email
        if params[:search].present?
          search_term = "%#{params[:search]}%"
          @contacts = @contacts.where(
            "full_name ILIKE ? OR email ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?",
            search_term, search_term, search_term, search_term
          )
        end

        # Filter by contact type
        if params[:type].present?
          case params[:type]
          when 'customers'
            @contacts = @contacts.customers
          when 'suppliers'
            @contacts = @contacts.suppliers
          when 'both'
            # Filter for contacts that have both 'customer' and 'supplier' in contact_types array
            @contacts = @contacts.where("contact_types @> ARRAY['customer', 'supplier']::text[]")
          end
        end

        # Filter by Xero sync status
        if params[:xero_sync].present?
          case params[:xero_sync]
          when 'synced'
            @contacts = @contacts.where.not(xero_id: nil)
          when 'not_synced'
            @contacts = @contacts.where(xero_id: nil)
          end
        end

        # Filter by having contact info
        @contacts = @contacts.with_email if params[:with_email] == "true"
        @contacts = @contacts.with_phone if params[:with_phone] == "true"

        @contacts = @contacts.order(:full_name)

        # Optionally include companies and jobs data
        include_companies = params[:include_companies] == 'true'
        include_jobs = params[:include_jobs] == 'true'

        contacts_json = @contacts.as_json(
          only: [:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :website, :contact_types, :primary_contact_type, :rating, :response_rate, :avg_response_time, :is_active, :supplier_code, :address, :notes, :lgas, :xero_id, :sync_with_xero, :last_synced_at, :total_purchase_orders_count, :total_purchase_orders_value, :teeem_rating, :entity_type, :primary_role, :employment_status],
          include: {
            portal_user: { only: [:id, :email, :portal_type, :active] }
          },
          methods: [:is_customer?, :is_supplier?, :is_sales?, :is_land_agent?, :display_name]
        )

        # Add company and job counts for all contacts
        if include_companies || include_jobs
          contacts_json.each do |contact_json|
            contact = @contacts.find { |c| c.id == contact_json['id'] }
            next unless contact

            if include_companies
              # Add primary company info
              if contact.primary_company
                contact_json['primary_company'] = {
                  id: contact.primary_company.id,
                  name: contact.primary_company.display_name
                }
              end

              # Count additional companies
              contact_json['additional_companies_count'] = contact.outgoing_relationships
                .active
                .where(relationship_type: ['director_of', 'shareholder_of', 'trustee_of', 'employee_of', 'partner_in'])
                .count
            end

            if include_jobs
              # Count jobs
              contact_json['jobs_count'] = contact.job_contacts.count
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
          only: [
            :id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :fax_phone, :website,
            :tax_number, :xero_id, :sync_with_xero, :last_synced_at, :xero_sync_error,
            :sys_type_id, :deleted, :parent_id, :parent,
            :drive_id, :folder_id, :contact_region_id, :contact_region, :branch, :created_at, :updated_at,
            :contact_types, :primary_contact_type, :rating, :response_rate, :avg_response_time, :is_active, :supplier_code, :address, :notes, :lgas,
            :entity_type, :primary_role, :employment_status,
            # Xero fields
            :bank_bsb, :bank_account_number, :bank_account_name,
            :default_purchase_account, :default_sales_account,
            :bill_due_day, :bill_due_type, :sales_due_day, :sales_due_type,
            :xero_contact_number, :xero_contact_status, :xero_account_number, :company_number, :default_discount,
            :accounts_receivable_outstanding, :accounts_receivable_overdue,
            :accounts_payable_outstanding, :accounts_payable_overdue
          ],
          include: {
            contact_persons: { only: [:id, :first_name, :last_name, :email, :include_in_emails, :is_primary, :xero_contact_person_id] },
            contact_addresses: { only: [:id, :address_type, :line1, :line2, :line3, :line4, :city, :region, :postal_code, :country, :attention_to, :is_primary] },
            contact_groups: { only: [:id, :name, :status, :xero_contact_group_id] },
            portal_user: { only: [:id, :email, :portal_type, :active, :last_login_at, :created_at] }
          },
          methods: [:is_customer?, :is_supplier?, :is_sales?, :is_land_agent?]
        )

        # If contact is a supplier, add pricebook items and purchase orders
        if @contact.is_supplier?
          # Get items where this contact is the supplier OR default_supplier OR has provided a quote (in price_histories)
          # Optimized to use a single query with LEFT JOIN instead of 3 separate queries
          all_items = PricebookItem
            .left_joins(:price_histories)
            .where(
              "pricebook_items.supplier_id = ? OR pricebook_items.default_supplier_id = ? OR price_histories.supplier_id = ?",
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
              .sort_by { |ph| [(ph.date_effective || Time.at(0)).to_time, (ph.created_at || Time.at(0)).to_time] }
              .reverse
              .map do |ph|
                ph.as_json(only: [:id, :old_price, :new_price, :date_effective, :lga, :change_reason, :user_name, :created_at])
              end

            item.as_json(
              only: [:id, :item_code, :item_name, :category, :current_price, :unit, :price_last_updated_at]
            ).merge(
              is_default_supplier: item.default_supplier_id == @contact.id,
              price_histories: price_histories
            )
          end
        end

        # Add primary company and employment details
        if @contact.primary_company.present?
          contact_json[:primary_company] = {
            id: @contact.primary_company.id,
            name: @contact.primary_company.display_name,
            contact_types: @contact.primary_company.contact_types,
            role: @contact.primary_role,
            employment_status: @contact.employment_status,
            start_date: @contact.employment_start_date
          }
        end

        # Add additional companies via relationships
        contact_json[:additional_companies] = @contact.outgoing_relationships
          .active
          .where(relationship_type: ['director_of', 'shareholder_of', 'trustee_of', 'employee_of', 'partner_in', 'authorized_signatory_of', 'beneficial_owner_of'])
          .includes(:related_contact)
          .map do |rel|
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
          .includes(:job)
          .map do |jc|
            {
              job_id: jc.job_id,
              job_title: jc.job.title,
              location: jc.job.location,
              role: jc.role,
              primary: jc.primary,
              status: jc.job.status,
              stage: jc.job.stage
            }
          end

        # Add all relationships (both outgoing and incoming)
        # Outgoing: relationships where this contact is the source (e.g., John is employee_of ACME)
        outgoing_rels = @contact.outgoing_relationships
          .active
          .includes(:related_contact)
          .map do |rel|
            {
              id: rel.id,
              direction: 'outgoing',
              relationship_type: rel.relationship_type,
              related_contact: {
                id: rel.related_contact.id,
                full_name: rel.related_contact.full_name,
                company_name: rel.related_contact.company_name_or_trust,
                email: rel.related_contact.email,
                mobile_phone: rel.related_contact.mobile_phone,
                entity_type: rel.related_contact.entity_type
              },
              role_in_relationship: rel.role_in_relationship,
              notes: rel.notes
            }
          end

        # Incoming: relationships where this contact is the target (e.g., ACME has John as employee)
        incoming_rels = @contact.incoming_relationships
          .active
          .includes(:source_contact)
          .map do |rel|
            {
              id: rel.id,
              direction: 'incoming',
              relationship_type: rel.relationship_type,
              # For incoming, we show the source contact as the "related" person
              related_contact: {
                id: rel.source_contact.id,
                full_name: rel.source_contact.full_name,
                company_name: rel.source_contact.company_name_or_trust,
                email: rel.source_contact.email,
                mobile_phone: rel.source_contact.mobile_phone,
                entity_type: rel.source_contact.entity_type
              },
              role_in_relationship: rel.role_in_relationship,
              notes: rel.notes
            }
          end

        contact_json[:relationships] = outgoing_rels + incoming_rels
        contact_json[:outgoing_relationships] = outgoing_rels
        contact_json[:incoming_relationships] = incoming_rels

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
              only: [:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :website, :contact_types, :primary_contact_type, :rating, :response_rate, :avg_response_time, :is_active, :supplier_code, :address, :notes, :lgas],
              methods: [:is_customer?, :is_supplier?, :is_sales?, :is_land_agent?]
            )
          }
        else
          render json: { success: false, errors: @contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:id
      def destroy
        # Comprehensive safety checks before deletion

        # Check for linked suppliers
        if @contact.suppliers.any?
          suppliers_with_pos = @contact.suppliers.joins(:purchase_orders).distinct

          if suppliers_with_pos.any?
            # Check if any POs have been paid or invoiced
            paid_pos = PurchaseOrder.where(supplier_id: suppliers_with_pos.pluck(:id))
                                   .where("status IN (?) OR amount_paid > 0 OR amount_invoiced > 0",
                                          ['paid', 'invoiced', 'received'])

            if paid_pos.any?
              return render json: {
                success: false,
                error: "Cannot delete contact with purchase orders that have been paid or invoiced. This contact has #{paid_pos.count} critical purchase order(s).",
                reason: "paid_purchase_orders",
                count: paid_pos.count
              }, status: :unprocessable_entity
            end

            # Check for any purchase orders at all
            total_pos = PurchaseOrder.where(supplier_id: suppliers_with_pos.pluck(:id)).count
            if total_pos > 0
              return render json: {
                success: false,
                error: "Cannot delete contact with #{total_pos} purchase order(s). Please reassign or delete purchase orders first.",
                reason: "has_purchase_orders",
                count: total_pos
              }, status: :unprocessable_entity
            end
          end

          # If suppliers exist but no POs, just warn
          return render json: {
            success: false,
            error: "Cannot delete contact with #{@contact.suppliers.count} linked supplier(s). Please unlink suppliers first.",
            reason: "has_suppliers",
            count: @contact.suppliers.count
          }, status: :unprocessable_entity
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

      # PATCH /api/v1/contacts/bulk_update
      def bulk_update
        contact_ids = params[:contact_ids]
        contact_types = params[:contact_types]

        # Validate contact_ids is present and is an array
        if contact_ids.blank? || !contact_ids.is_a?(Array)
          return render json: {
            success: false,
            error: "contact_ids must be a non-empty array"
          }, status: :unprocessable_entity
        end

        # Validate contact_types is valid
        if contact_types.blank? || !contact_types.is_a?(Array)
          return render json: {
            success: false,
            error: "contact_types must be a non-empty array"
          }, status: :unprocessable_entity
        end

        invalid_types = contact_types - Contact::CONTACT_TYPES
        if invalid_types.any?
          return render json: {
            success: false,
            error: "Invalid contact types: #{invalid_types.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Update all contacts in a single query using update_all for performance
        # This bypasses validations and callbacks but is much faster for bulk operations
        updated_count = Contact.where(id: contact_ids).update_all(contact_types: contact_types)

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

      # POST /api/v1/contacts/match_supplier
      def match_supplier
        contact_id = params[:contact_id]
        supplier_name = params[:supplier_name]

        if contact_id.blank? || supplier_name.blank?
          return render json: {
            success: false,
            error: "contact_id and supplier_name are required"
          }, status: :bad_request
        end

        contact = Contact.find(contact_id)

        # Find supplier by name (case-insensitive)
        supplier = Supplier.where("LOWER(name) = ?", supplier_name.downcase).first

        unless supplier
          return render json: {
            success: false,
            error: "No supplier found with name '#{supplier_name}'"
          }, status: :not_found
        end

        # Import supplier history into contact
        contact.update(
          contact_types: (contact.contact_types + ['supplier']).uniq,
          rating: supplier.rating || contact.rating,
          response_rate: supplier.response_rate || contact.response_rate,
          avg_response_time: supplier.avg_response_time || contact.avg_response_time,
          is_active: supplier.is_active.nil? ? contact.is_active : supplier.is_active,
          supplier_code: supplier.supplier_code || contact.supplier_code,
          address: supplier.address || contact.address,
          notes: [contact.notes, supplier.notes].compact.join("\n\n")
        )

        # Link the supplier to this contact
        supplier.update(contact_id: contact.id)

        render json: {
          success: true,
          message: "Successfully matched contact with supplier '#{supplier.name}'",
          contact: contact.as_json(
            only: [:id, :full_name, :first_name, :last_name, :email, :contact_types, :rating, :notes]
          ),
          imported_fields: {
            rating: supplier.rating,
            response_rate: supplier.response_rate,
            avg_response_time: supplier.avg_response_time,
            supplier_code: supplier.supplier_code,
            notes: supplier.notes.present?
          }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: {
          success: false,
          error: "Contact not found: #{e.message}"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: "Failed to match supplier: #{e.message}"
        }, status: :internal_server_error
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
            total_count: [default_count, history_count].max
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
        effective_date = params[:effective_date].present? ? Date.parse(params[:effective_date]) : CompanySetting.today

        # Which price to copy: 'active' (default), 'latest', or 'oldest'
        # - active: Most recent date_effective (current active price)
        # - latest: Most recently created price history
        # - oldest: Oldest price history (original price)
        copy_mode = params[:copy_mode].presence || 'active'

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
          when 'latest'
            'pricebook_item_id, created_at DESC'
          when 'oldest'
            'pricebook_item_id, created_at ASC'
          else # 'active' (default)
            'pricebook_item_id, date_effective DESC NULLS LAST, created_at DESC'
          end

          source_price_histories = PriceHistory.where(supplier_id: source_id)
            .joins(:pricebook_item)
            .select('DISTINCT ON (pricebook_item_id) price_histories.*')
            .order(order_clause)

          # Filter by categories if provided
          if categories.present? && categories.is_a?(Array) && categories.any?
            source_price_histories = source_price_histories.where(pricebook_items: { category: categories })
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
                change_reason: "Copied from #{source_contact.full_name}"
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
          source_contact: source_contact.full_name,
          target_contact: target_contact.full_name,
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
          price_histories_to_delete = PriceHistory.joins(:pricebook_item)
            .where(supplier_id: contact.id)
            .where(pricebook_items: { category: categories })

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
            # Merge contact types
            merged_types = (target_contact.contact_types + source.contact_types).uniq
            target_contact.update(contact_types: merged_types)

            # Fill in missing contact information from source if target is missing it
            target_contact.update(email: source.email) if target_contact.email.blank? && source.email.present?
            target_contact.update(mobile_phone: source.mobile_phone) if target_contact.mobile_phone.blank? && source.mobile_phone.present?
            target_contact.update(office_phone: source.office_phone) if target_contact.office_phone.blank? && source.office_phone.present?
            target_contact.update(website: source.website) if target_contact.website.blank? && source.website.present?
            target_contact.update(address: source.address) if target_contact.address.blank? && source.address.present?

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

            # Delete the source contact
            source.destroy
          end
        end

        render json: {
          success: true,
          message: "Successfully merged #{source_contacts.count} contact(s) into #{target_contact.full_name}",
          contact: target_contact.as_json(
            only: [:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :website, :contact_types]
          )
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
            change_reason = update[:change_reason].presence || 'bulk_update'
            date_effective = update[:date_effective].present? ? Date.parse(update[:date_effective].to_s) : CompanySetting.today

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
            user_name = current_user&.name || 'System'

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
            activity_type: sms.direction == 'outbound' ? 'sms_sent' : 'sms_received',
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

      # POST /api/v1/contacts/:id/link_xero_contact
      # Manually link a TEEEM contact to a Xero contact
      def link_xero_contact
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

          xero_contact = result[:data]['Contacts']&.first

          unless xero_contact
            return render json: {
              success: false,
              error: "Xero contact not found"
            }, status: :not_found
          end

          # Update the contact with the Xero ID and sync timestamp
          @contact.update!(
            xero_id: xero_contact['ContactID'],
            last_synced_at: Time.current,
            xero_sync_error: nil,
            sync_with_xero: true
          )

          # Log the manual link activity
          ContactActivity.create!(
            contact: @contact,
            activity_type: 'linked_to_xero',
            description: "Manually linked to Xero contact: #{xero_contact['Name']}",
            metadata: {
              xero_contact_id: xero_contact['ContactID'],
              xero_contact_name: xero_contact['Name'],
              linked_via: 'manual'
            },
            performed_by: @contact,
            occurred_at: Time.current
          )

          render json: {
            success: true,
            message: "Successfully linked contact to Xero: #{xero_contact['Name']}",
            contact: @contact.as_json(
              only: [:id, :full_name, :xero_id, :last_synced_at, :sync_with_xero]
            ),
            xero_contact: {
              xero_id: xero_contact['ContactID'],
              name: xero_contact['Name'],
              email: xero_contact['EmailAddress'],
              tax_number: xero_contact['TaxNumber']
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

      # POST /api/v1/contacts/:id/portal_user
      def create_portal_user
        portal_type = params[:portal_type] || 'supplier'
        email = params[:email]
        password = params[:password]

        if email.blank? || password.blank?
          return render json: {
            success: false,
            error: "Email and password are required"
          }, status: :unprocessable_entity
        end

        begin
          @contact.enable_portal!(portal_type, email: email, password: password)

          # Note: Password should be displayed to user immediately in the UI
          # and then securely transmitted separately (e.g., via email)
          # We no longer return it in the API response for security
          render json: {
            success: true,
            portal_user: @contact.portal_user.as_json(only: [:id, :email, :portal_type, :active, :created_at]),
            message: 'Portal access enabled successfully. Password has been set.'
          }
        rescue => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/contacts/:id/portal_user
      def update_portal_user
        portal_user = @contact.portal_user

        unless portal_user
          return render json: {
            success: false,
            error: "No portal user exists for this contact"
          }, status: :not_found
        end

        update_params = {}
        update_params[:email] = params[:email] if params[:email].present?
        update_params[:password] = params[:password] if params[:password].present?
        update_params[:portal_type] = params[:portal_type] if params[:portal_type].present?
        update_params[:active] = params[:active] unless params[:active].nil?

        if portal_user.update(update_params)
          response_data = {
            success: true,
            portal_user: portal_user.as_json(only: [:id, :email, :portal_type, :active, :created_at])
          }
          # Add message if password was changed
          if params[:password].present?
            response_data[:message] = 'Portal user updated successfully. Password has been changed.'
          end
          render json: response_data
        else
          render json: {
            success: false,
            errors: portal_user.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:id/portal_user
      def delete_portal_user
        portal_user = @contact.portal_user

        unless portal_user
          return render json: {
            success: false,
            error: "No portal user exists for this contact"
          }, status: :not_found
        end

        portal_user.destroy
        @contact.update(portal_enabled: false)

        render json: {
          success: true,
          message: "Portal user deleted successfully"
        }
      end

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

      private

      def set_contact
        @contact = Contact.find(params[:id])
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
            group = ContactGroup.find_or_create_by!(name: group_name, status: 'ACTIVE')
            @contact.contact_group_memberships.create!(contact_group: group) unless @contact.contact_groups.include?(group)
          end
        end
      end

      def contact_params
        params.require(:contact).permit(
          :full_name,
          :first_name,
          :last_name,
          :email,
          :mobile_phone,
          :office_phone,
          :fax_phone,
          :website,
          :tax_number,
          :xero_id,
          :sys_type_id,
          :deleted,
          :parent_id,
          :parent,
          :drive_id,
          :folder_id,
          :sync_with_xero,
          :contact_region_id,
          :contact_region,
          :branch,
          :primary_contact_type,
          :rating,
          :response_rate,
          :avg_response_time,
          :is_active,
          :supplier_code,
          :address,
          :notes,
          # Xero sync fields
          :bank_bsb,
          :bank_account_number,
          :bank_account_name,
          :default_purchase_account,
          :default_sales_account,
          :bill_due_day,
          :bill_due_type,
          :sales_due_day,
          :sales_due_type,
          :xero_contact_number,
          :xero_contact_status,
          :xero_account_number,
          :company_number,
          :default_discount,
          :entity_type,
          contact_types: [],
          lgas: [],
          contact_group_ids: [],
          new_contact_group_names: [],
          # Nested attributes for contact persons
          contact_persons_attributes: [:id, :first_name, :last_name, :email, :mobile, :role, :include_in_emails, :is_primary, :_destroy],
          # Nested attributes for contact addresses
          contact_addresses_attributes: [:id, :address_type, :line1, :line2, :line3, :line4, :city, :region, :postal_code, :country, :attention_to, :is_primary, :_destroy]
        )
      end
    end
  end
end
