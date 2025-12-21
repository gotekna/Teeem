class SimplifyTabGroups < ActiveRecord::Migration[7.2]
  def up
    # Merge 'data' and 'special' into 'overview'
    execute <<-SQL
      UPDATE entity_tabs 
      SET tab_group = 'overview' 
      WHERE tab_group IN ('data', 'special')
    SQL
  end

  def down
    # Cannot reliably reverse - would need to track original values
    raise ActiveRecord::IrreversibleMigration
  end
end
