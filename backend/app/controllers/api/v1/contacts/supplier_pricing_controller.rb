# frozen_string_literal: true

# SSoT: Supplier Pricing Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - categories: GET /api/v1/contacts/supplier_pricing/:contact_id/categories
#   - copy_history: POST /api/v1/contacts/supplier_pricing/:contact_id/copy_history
#   - remove_categories: DELETE /api/v1/contacts/supplier_pricing/:contact_id/categories
#   - bulk_update: POST /api/v1/contacts/supplier_pricing/:contact_id/bulk_update
#   - delete_column: DELETE /api/v1/contacts/supplier_pricing/:contact_id/column
#
module Api
  module V1
    module Contacts
      class SupplierPricingController < ApplicationController
        before_action :authorize_request
        before_action :set_contact
        before_action :require_supplier

        # GET /api/v1/contacts/supplier_pricing/:contact_id/categories
        # Returns categories where this supplier has pricing
        def categories
          # Get distinct categories from pricebook items where this contact is the default supplier
          # or has provided price histories
          categories_from_default = PricebookItem.where(default_supplier_id: @contact.id)
                                                .where.not(category: nil)
                                                .distinct
                                                .pluck(:category)

          categories_from_histories = PricebookItem.joins(:price_histories)
                                                  .where(price_histories: { supplier_id: @contact.id })
                                                  .where.not(category: nil)
                                                  .distinct
                                                  .pluck(:category)

          all_categories = (categories_from_default + categories_from_histories).uniq.sort

          # Get item counts per category
          categories_with_counts = all_categories.map do |category|
            default_count = PricebookItem.where(default_supplier_id: @contact.id, category: category).count
            history_count = PricebookItem.joins(:price_histories)
                                        .where(price_histories: { supplier_id: @contact.id })
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
        rescue => e
          render json: {
            success: false,
            error: "Failed to fetch categories: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/supplier_pricing/:contact_id/copy_history
        # Copy price history from another supplier
        def copy_history
          source_id = params[:source_id]
          categories_param = params[:categories] # Optional array of categories to filter by
          set_as_default = params[:set_as_default] != false # Default to true unless explicitly false
          effective_date = params[:effective_date].present? ? Date.parse(params[:effective_date]) : CorporateCompanySetting.today

          # Which price to copy: 'active' (default), 'latest', or 'oldest'
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

          source_contact = Contact.find(source_id)

          unless source_contact.is_supplier?
            return render json: {
              success: false,
              error: "Source contact must be a supplier"
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
            # Note: PricebookItem uses table_name = 'pricebooks'
            if categories_param.present? && categories_param.is_a?(Array) && categories_param.any?
              source_price_histories = source_price_histories.where(pricebooks: { category: categories_param })
            end

            source_price_histories.each do |selected_price_history|
              item = selected_price_history.pricebook_item

              # Only set target as the new default supplier if requested
              if set_as_default
                item.update!(default_supplier_id: @contact.id)
                updated_count += 1
              end

              # Check if target already has a price history with the same price and effective date
              existing_history = PriceHistory.where(
                pricebook_item_id: item.id,
                supplier_id: @contact.id,
                new_price: selected_price_history.new_price,
                date_effective: effective_date
              ).exists?

              # Only create if this exact price/date combination doesn't exist
              unless existing_history
                PriceHistory.create!(
                  pricebook_item_id: item.id,
                  old_price: selected_price_history.old_price,
                  new_price: selected_price_history.new_price,
                  supplier_id: @contact.id,
                  lga: selected_price_history.lga,
                  date_effective: effective_date,
                  change_reason: "Copied from #{source_contact.display_name}"
                )
                copied_count += 1
              end
            end
          end

          category_msg = if categories_param.present? && categories_param.any?
            " for #{categories_param.join(', ')} categories"
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
            target_contact: @contact.display_name,
            categories: categories_param || [],
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

        # DELETE /api/v1/contacts/supplier_pricing/:contact_id/categories
        # Remove supplier from specific categories
        def remove_categories
          categories_param = params[:categories]

          if categories_param.blank? || !categories_param.is_a?(Array) || categories_param.empty?
            return render json: {
              success: false,
              error: "categories (array) is required"
            }, status: :bad_request
          end

          removed_from_default_count = 0
          deleted_price_histories_count = 0

          ActiveRecord::Base.transaction do
            # Find all pricebook items where this contact is the default supplier
            # and the category is in the provided list
            default_supplier_items = PricebookItem.where(
              default_supplier_id: @contact.id,
              category: categories_param
            )

            default_supplier_items.each do |item|
              item.update!(default_supplier_id: nil)
              removed_from_default_count += 1
            end

            # Delete all price histories for this supplier in the selected categories
            # Note: PricebookItem uses table_name = 'pricebooks'
            price_histories_to_delete = PriceHistory.joins(:pricebook_item)
              .where(supplier_id: @contact.id)
              .where(pricebooks: { category: categories_param })

            deleted_price_histories_count = price_histories_to_delete.count
            price_histories_to_delete.delete_all
          end

          message_parts = []
          message_parts << "Removed as default supplier from #{removed_from_default_count} items" if removed_from_default_count > 0
          message_parts << "Deleted #{deleted_price_histories_count} price histories" if deleted_price_histories_count > 0

          message = if message_parts.any?
            "#{message_parts.join(' and ')} in #{categories_param.join(', ')}"
          else
            "No items or price histories found for this supplier in #{categories_param.join(', ')}"
          end

          render json: {
            success: true,
            message: message,
            removed_from_default_count: removed_from_default_count,
            deleted_price_histories_count: deleted_price_histories_count,
            categories: categories_param
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to remove from categories: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/supplier_pricing/:contact_id/bulk_update
        # Bulk update prices for multiple items
        def bulk_update
          updates = params[:updates]

          if updates.blank? || !updates.is_a?(Array) || updates.empty?
            return render json: {
              success: false,
              error: "updates (array) is required and must not be empty"
            }, status: :bad_request
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

              user_name = current_user&.name || "System"

              begin
                PriceHistory.create!(
                  pricebook_item_id: item.id,
                  old_price: item.current_price,
                  new_price: new_price,
                  supplier_id: @contact.id,
                  date_effective: date_effective,
                  change_reason: change_reason,
                  changed_by_user_id: current_user&.id,
                  user_name: user_name
                )

                # Update item's current price if this is the default supplier
                if item.default_supplier_id == @contact.id
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
        rescue => e
          render json: {
            success: false,
            error: "Failed to bulk update prices: #{e.message}"
          }, status: :internal_server_error
        end

        # DELETE /api/v1/contacts/supplier_pricing/:contact_id/column
        # Delete all price histories for a specific effective date
        def delete_column
          date_effective = params[:date_effective] || params.dig(:params, :date_effective)

          if date_effective.blank?
            return render json: {
              success: false,
              error: "date_effective is required"
            }, status: :bad_request
          end

          deleted_count = 0

          ActiveRecord::Base.transaction do
            price_histories = PriceHistory.where(
              supplier_id: @contact.id,
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
        rescue => e
          render json: {
            success: false,
            error: "Failed to delete price column: #{e.message}"
          }, status: :internal_server_error
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

        def require_supplier
          return if @contact.nil? # Already handled by set_contact

          unless @contact.is_supplier?
            render json: {
              success: false,
              error: "Contact must be a supplier"
            }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
