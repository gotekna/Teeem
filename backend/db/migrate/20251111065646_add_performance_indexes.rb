class AddPerformanceIndexes < ActiveRecord::Migration[8.0]
  def change
    # Helper method to safely add index only if table and column exist
    def safe_add_index(table, columns, **options)
      return unless table_exists?(table)

      columns_array = Array(columns)
      return unless columns_array.all? { |col| column_exists?(table, col) }
      return if index_exists?(table, columns, **options.slice(:name))

      add_index(table, columns, **options.merge(if_not_exists: true))
    end

    # Emails table indexes
    safe_add_index :emails, :user_id
    safe_add_index :emails, :received_at
    safe_add_index :emails, :construction_id

    # Purchase orders table indexes
    safe_add_index :purchase_orders, :required_date
    safe_add_index :purchase_orders, :payment_status
    safe_add_index :purchase_orders, :construction_id
    safe_add_index :purchase_orders, :supplier_id

    # Contacts table indexes
    safe_add_index :contacts, :email
    safe_add_index :contacts, [ :xero_id, :last_synced_at ], name: 'index_contacts_on_xero_id_and_last_synced_at'

    # Schedule tasks table indexes
    safe_add_index :schedule_tasks, :construction_id
    safe_add_index :schedule_tasks, :start_date
    safe_add_index :schedule_tasks, :end_date
    safe_add_index :schedule_tasks, :status

    # Constructions table indexes
    safe_add_index :constructions, :status
    safe_add_index :constructions, :created_at

    # Price histories table indexes (for pricebook performance)
    safe_add_index :price_histories, :pricebook_item_id
    safe_add_index :price_histories, :contact_id
    safe_add_index :price_histories, :effective_date

    # Chat messages table indexes
    safe_add_index :chat_messages, :user_id
    safe_add_index :chat_messages, :created_at
    safe_add_index :chat_messages, :unread
  end
end
