# Fix email_warehouse.id column missing its sequence default
# This was causing "null value in column id" errors on insert
class FixEmailWarehouseIdSequence < ActiveRecord::Migration[8.0]
  def up
    # Only fix if the default is missing
    result = execute("SELECT column_default FROM information_schema.columns WHERE table_name = 'email_warehouse' AND column_name = 'id'")
    current_default = result.first&.fetch("column_default", nil)

    if current_default.blank?
      # Create sequence if it doesn't exist
      execute <<-SQL
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'email_warehouse_id_seq') THEN
            CREATE SEQUENCE email_warehouse_id_seq;
          END IF;
        END $$;
      SQL

      # Link sequence to column
      execute "ALTER TABLE email_warehouse ALTER COLUMN id SET DEFAULT nextval('email_warehouse_id_seq'::regclass)"

      # Set sequence to max id + 1
      execute "SELECT setval('email_warehouse_id_seq', COALESCE((SELECT MAX(id) FROM email_warehouse), 0) + 1)"
    end
  end

  def down
    # No rollback needed - the default should stay
  end
end
