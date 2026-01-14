class AddSupplierConfirmationDetailsToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    # Template rows
    add_column :sm_schedule_masters, :supplier_confirmation_method, :string
    add_column :sm_schedule_masters, :supplier_confirmed_contact_name, :string

    # Job tasks
    add_column :sm_tasks, :supplier_confirmation_method, :string
    add_column :sm_tasks, :supplier_confirmed_contact_name, :string
  end
end
