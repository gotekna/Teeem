class AddSmTemplateRowToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :sm_template_row_id, :bigint unless column_exists?(:purchase_orders, :sm_template_row_id)
    add_index :purchase_orders, :sm_template_row_id unless index_exists?(:purchase_orders, :sm_template_row_id)

    # Backfill from SmTask relationship (PO -> SmTask -> SmTemplateRow)
    reversible do |dir|
      dir.up do
        if table_exists?(:sm_tasks)
          execute <<-SQL
            UPDATE purchase_orders po
            SET sm_template_row_id = (
              SELECT sm_template_row_id
              FROM sm_tasks st
              WHERE st.purchase_order_id = po.id
              AND st.sm_template_row_id IS NOT NULL
              LIMIT 1
            )
            WHERE po.sm_template_row_id IS NULL
          SQL
        end
      end
    end
  end
end
