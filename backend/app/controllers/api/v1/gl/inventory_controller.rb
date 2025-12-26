# frozen_string_literal: true

module Api
  module V1
    module Gl
      class InventoryController < ApplicationController
        # ==========================================
        # INVENTORY ITEMS
        # ==========================================

        # GET /api/v1/gl/inventory
        def index
          items = current_company.gl_inventory_items
                                 .includes(:cogs_account, :inventory_account)

          # Filter by status
          items = items.where(status: params[:status]) if params[:status].present?

          # Filter by category
          items = items.where(category: params[:category]) if params[:category].present?

          # Low stock items
          items = items.low_stock if params[:low_stock] == "true"

          # Out of stock
          items = items.out_of_stock if params[:out_of_stock] == "true"

          render json: {
            success: true,
            data: items.map { |i| item_json(i) }
          }
        end

        # GET /api/v1/gl/inventory/:id
        def show
          item = find_item

          render json: {
            success: true,
            data: item_json(item, include_transactions: params[:include_transactions] == "true")
          }
        end

        # POST /api/v1/gl/inventory
        def create
          item = current_company.gl_inventory_items.build(item_params)

          if item.save
            render json: {
              success: true,
              data: item_json(item),
              message: "Inventory item created"
            }
          else
            render json: {
              success: false,
              error: item.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/inventory/:id
        def update
          item = find_item

          if item.update(item_params)
            render json: {
              success: true,
              data: item_json(item),
              message: "Inventory item updated"
            }
          else
            render json: {
              success: false,
              error: item.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/inventory/:id/receive
        def receive
          item = find_item

          item.receive!(
            quantity: params[:quantity].to_d,
            unit_cost: params[:unit_cost]&.to_d,
            user: current_user,
            notes: params[:notes]
          )

          render json: {
            success: true,
            data: item_json(item.reload),
            message: "Stock received: #{params[:quantity]} units"
          }
        end

        # POST /api/v1/gl/inventory/:id/sell
        def sell
          item = find_item

          cost = item.sell!(
            quantity: params[:quantity].to_d,
            user: current_user,
            notes: params[:notes]
          )

          render json: {
            success: true,
            data: item_json(item.reload),
            cogs: cost,
            message: "Stock sold: #{params[:quantity]} units"
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/inventory/:id/adjust
        def adjust
          item = find_item

          item.adjust!(
            quantity: params[:quantity].to_d,
            reason: params[:reason],
            user: current_user
          )

          render json: {
            success: true,
            data: item_json(item.reload),
            message: "Stock adjusted to #{params[:quantity]} units"
          }
        end

        # POST /api/v1/gl/inventory/:id/write_off
        def write_off
          item = find_item

          item.write_off!(
            quantity: params[:quantity].to_d,
            reason: params[:reason],
            user: current_user
          )

          render json: {
            success: true,
            data: item_json(item.reload),
            message: "Stock written off: #{params[:quantity]} units"
          }
        end

        # GET /api/v1/gl/inventory/:id/transactions
        def transactions
          item = find_item
          txns = item.transactions.order(transaction_date: :desc)

          if params[:from].present? && params[:to].present?
            txns = txns.for_period(Date.parse(params[:from]), Date.parse(params[:to]))
          end

          render json: {
            success: true,
            data: txns.limit(params[:limit] || 100).map { |t| transaction_json(t) }
          }
        end

        # GET /api/v1/gl/inventory/low_stock
        def low_stock
          items = current_company.gl_inventory_items.active.tracked.low_stock

          render json: {
            success: true,
            data: items.map { |i| item_json(i) }
          }
        end

        # GET /api/v1/gl/inventory/valuation
        def valuation
          items = current_company.gl_inventory_items.active.tracked

          by_category = items.group(:category).sum("quantity_on_hand * COALESCE(cost_price, 0)")

          render json: {
            success: true,
            data: {
              total_value: items.sum("quantity_on_hand * COALESCE(cost_price, 0)"),
              total_items: items.count,
              total_quantity: items.sum(:quantity_on_hand),
              by_category: by_category,
              items: items.order(:name).map do |i|
                {
                  id: i.id,
                  sku: i.sku,
                  name: i.name,
                  quantity: i.quantity_on_hand,
                  cost_price: i.cost_price,
                  value: i.inventory_value
                }
              end
            }
          }
        end

        # ==========================================
        # STOCK COUNTS
        # ==========================================

        # GET /api/v1/gl/inventory/stock_counts
        def stock_counts
          counts = current_company.gl_stock_counts
                                  .includes(:created_by, :approved_by)
                                  .order(count_date: :desc)

          render json: {
            success: true,
            data: counts.map { |c| stock_count_json(c) }
          }
        end

        # GET /api/v1/gl/inventory/stock_counts/:id
        def show_stock_count
          count = current_company.gl_stock_counts.find(params[:id])

          render json: {
            success: true,
            data: stock_count_json(count, include_lines: true)
          }
        end

        # POST /api/v1/gl/inventory/stock_counts
        def create_stock_count
          count = current_company.gl_stock_counts.build(stock_count_params)
          count.created_by = current_user

          if count.save
            count.populate_all_items! if params[:populate_all] == "true"

            render json: {
              success: true,
              data: stock_count_json(count, include_lines: true),
              message: "Stock count created"
            }
          else
            render json: {
              success: false,
              error: count.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/inventory/stock_counts/:id/start
        def start_stock_count
          count = current_company.gl_stock_counts.find(params[:id])
          count.start!

          render json: {
            success: true,
            data: stock_count_json(count),
            message: "Stock count started"
          }
        end

        # PATCH /api/v1/gl/inventory/stock_counts/:id/lines
        def update_count_lines
          count = current_company.gl_stock_counts.find(params[:id])

          params[:lines].each do |line_data|
            line = count.lines.find(line_data[:id])
            line.update!(counted_quantity: line_data[:counted_quantity], notes: line_data[:notes])
          end

          render json: {
            success: true,
            data: stock_count_json(count.reload, include_lines: true),
            message: "Count lines updated"
          }
        end

        # POST /api/v1/gl/inventory/stock_counts/:id/complete
        def complete_stock_count
          count = current_company.gl_stock_counts.find(params[:id])
          count.complete!

          render json: {
            success: true,
            data: stock_count_json(count, include_lines: true),
            message: "Stock count completed - ready for approval"
          }
        end

        # POST /api/v1/gl/inventory/stock_counts/:id/approve
        def approve_stock_count
          count = current_company.gl_stock_counts.find(params[:id])
          count.approve!(current_user)

          render json: {
            success: true,
            data: stock_count_json(count, include_lines: true),
            message: "Stock count approved and adjustments applied"
          }
        end

        private

        def find_item
          current_company.gl_inventory_items.find(params[:id])
        end

        def item_params
          params.permit(
            :sku, :name, :description, :category, :unit_of_measure,
            :cost_price, :sale_price, :costing_method,
            :reorder_point, :reorder_quantity, :track_inventory,
            :status, :is_sellable, :is_purchasable,
            :cogs_account_id, :inventory_account_id, :income_account_id,
            :pricebook_item_id
          )
        end

        def stock_count_params
          params.permit(:count_date, :notes)
        end

        def item_json(item, include_transactions: false)
          data = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description,
            category: item.category,
            unit_of_measure: item.unit_of_measure,
            cost_price: item.cost_price,
            sale_price: item.sale_price,
            costing_method: item.costing_method,
            quantity_on_hand: item.quantity_on_hand,
            quantity_committed: item.quantity_committed,
            quantity_on_order: item.quantity_on_order,
            quantity_available: item.quantity_available,
            reorder_point: item.reorder_point,
            reorder_quantity: item.reorder_quantity,
            track_inventory: item.track_inventory,
            status: item.status,
            stock_status: item.stock_status,
            needs_reorder: item.needs_reorder?,
            inventory_value: item.inventory_value,
            is_sellable: item.is_sellable,
            is_purchasable: item.is_purchasable,
            last_received_at: item.last_received_at,
            last_sold_at: item.last_sold_at,
            last_counted_at: item.last_counted_at
          }

          if include_transactions
            data[:recent_transactions] = item.transactions
                                             .order(transaction_date: :desc)
                                             .limit(10)
                                             .map { |t| transaction_json(t) }
          end

          data
        end

        def transaction_json(txn)
          {
            id: txn.id,
            transaction_type: txn.transaction_type,
            type_label: txn.type_label,
            quantity: txn.quantity,
            unit_cost: txn.unit_cost,
            total_cost: txn.total_cost,
            quantity_before: txn.quantity_before,
            quantity_after: txn.quantity_after,
            direction: txn.movement_direction,
            notes: txn.notes,
            user: txn.user&.name,
            transaction_date: txn.transaction_date
          }
        end

        def stock_count_json(count, include_lines: false)
          data = {
            id: count.id,
            reference: count.reference,
            count_date: count.count_date,
            status: count.status,
            notes: count.notes,
            started_at: count.started_at,
            completed_at: count.completed_at,
            created_by: count.created_by&.name,
            approved_by: count.approved_by&.name,
            total_variance_value: count.total_variance_value,
            items_with_variance: count.items_with_variance,
            total_items: count.lines.count
          }

          if include_lines
            data[:lines] = count.lines.includes(:inventory_item).map do |line|
              {
                id: line.id,
                inventory_item_id: line.inventory_item_id,
                sku: line.inventory_item.sku,
                name: line.inventory_item.name,
                system_quantity: line.system_quantity,
                counted_quantity: line.counted_quantity,
                variance: line.variance,
                variance_value: line.variance_value,
                notes: line.notes
              }
            end
          end

          data
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
