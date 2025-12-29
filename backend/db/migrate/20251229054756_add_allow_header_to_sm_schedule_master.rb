class AddAllowHeaderToSmScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_master, :allow_header, :boolean, default: false, null: false

    # Set allow_header = true for existing header rows (rows with empty header field)
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE sm_schedule_master
          SET allow_header = true
          WHERE header IS NULL OR header = ''
        SQL

        # Uppercase names for header rows
        execute <<-SQL
          UPDATE sm_schedule_master
          SET name = UPPER(name)
          WHERE allow_header = true
        SQL
      end
    end
  end
end
