class BackfillSearchableOnColumns < ActiveRecord::Migration[8.0]
  def up
    # SSoT Fix: Backfill all NULL searchable values to true
    # Columns created before searchable field existed have NULL values
    # This ensures frontend receives explicit true/false, never NULL
    execute <<-SQL
      UPDATE columns SET searchable = true WHERE searchable IS NULL
    SQL

    # Log the count for visibility
    count = Column.where(searchable: true).count
    puts "Backfilled searchable=true for all columns. Total searchable columns: #{count}"
  end

  def down
    # No rollback needed - we're just setting defaults
  end
end
