class AddClaimFieldsToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :is_claim_task, :boolean, default: false, null: false
    add_column :sm_schedule_masters, :claim_percentage, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_masters, :claim_invoice_pattern, :string

    add_index :sm_schedule_masters, :is_claim_task, where: "is_claim_task = true", name: "index_sm_schedule_masters_claim_tasks"
  end
end
