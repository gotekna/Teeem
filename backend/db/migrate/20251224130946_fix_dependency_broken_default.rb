class FixDependencyBrokenDefault < ActiveRecord::Migration[8.0]
  def up
    # Set default value for new records
    change_column_default :sm_template_rows, :dependency_broken, false

    # Update existing NULL values to false
    execute "UPDATE sm_template_rows SET dependency_broken = false WHERE dependency_broken IS NULL"
  end

  def down
    change_column_default :sm_template_rows, :dependency_broken, nil
  end
end
