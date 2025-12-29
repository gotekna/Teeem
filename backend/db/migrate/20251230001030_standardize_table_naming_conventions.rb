# Standardize table naming conventions to follow Rails plural naming
# This fixes recurring issues with migrations referencing wrong table names
#
# Tables renamed:
# - sm_schedule_master -> sm_schedule_masters
# - email_warehouse -> email_warehouses
# - pricebook -> pricebooks
# - trinity -> trinities
# - job_status -> job_statuses
#
class StandardizeTableNamingConventions < ActiveRecord::Migration[8.0]
  def change
    rename_table :sm_schedule_master, :sm_schedule_masters
    rename_table :email_warehouse, :email_warehouses
    rename_table :pricebook, :pricebooks
    rename_table :trinity, :trinities
    rename_table :job_status, :job_statuses
  end
end
