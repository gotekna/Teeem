class AddCompositeIndexes < ActiveRecord::Migration[8.0]
  def change
    # Helper method to safely add index only if table and column exist
    def safe_add_index(table, columns, **options)
      return unless table_exists?(table)

      columns_array = Array(columns)
      return unless columns_array.all? { |col| column_exists?(table, col) }
      return if index_exists?(table, columns, **options.slice(:name))

      add_index(table, columns, **options.merge(if_not_exists: true))
    end

    # Purchase Orders - frequently filtered by construction + status
    safe_add_index :purchase_orders, [ :construction_id, :status ],
                   name: 'index_purchase_orders_on_construction_and_status'

    # Project Tasks - frequently filtered
    safe_add_index :project_tasks, [ :project_id, :status, :planned_start_date ],
                   name: 'index_project_tasks_on_project_status_start'

    # Estimates - filtering
    safe_add_index :estimates, [ :construction_id, :status ],
                   name: 'index_estimates_on_construction_and_status'

    # Chat Messages - pagination
    safe_add_index :chat_messages, [ :construction_id, :channel, :created_at ],
                   name: 'index_chat_messages_on_construction_channel_created'

    # Pricebook Items - smart lookup searches
    safe_add_index :pricebook_items, [ :category, :is_active, :supplier_id ],
                   name: 'index_pricebook_items_on_category_active_supplier'
  end
end
