class DropUnusedExperimentalTables < ActiveRecord::Migration[8.0]
  def up
    # Delete orphaned records from the tables table where the actual DB tables no longer exist
    orphaned_table_ids = [2, 34, 36, 102, 103, 107, 108, 133, 134, 135, 136, 138, 167, 168, 169, 172]

    orphaned_table_ids.each do |table_id|
      table_record = Table.find_by(id: table_id)
      if table_record
        say "Removing orphaned table record: #{table_record.database_table_name} (#{table_record.name})"
        table_record.destroy
      end
    end

    say "Cleaned up #{orphaned_table_ids.length} orphaned table records"
  end

  def down
    # Cannot restore orphaned records as we don't have their original data
    say "Warning: Orphaned table records cannot be restored"
  end
end
