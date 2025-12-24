class FixDependencyBrokenDefault < ActiveRecord::Migration[8.0]
  def up
    # Set default value for new records
    change_column_default :sm_template_rows, :dependency_broken, false

    # Update existing NULL values to false
    SmTemplateRow.where(dependency_broken: nil).update_all(dependency_broken: false)
  end

  def down
    change_column_default :sm_template_rows, :dependency_broken, nil
  end
end
