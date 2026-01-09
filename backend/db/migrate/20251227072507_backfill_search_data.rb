# frozen_string_literal: true

# Gold Standard Search Infrastructure - Phase 3: Backfill
#
# Populates the searchable tsvector columns for existing data.
# This fires the triggers we created in the previous migration.
#
# Method: Update each record's updated_at to fire the trigger.
# We use batches to avoid locking issues on large tables.
#
# Expected data sizes:
# - email_warehouse: ~63k records (already has data, skip backfill)
# - corporate_company_documents: ~5k records
# - jobs: ~2k records
# - contacts: ~10k records
# - sm_tasks: ~5k records
# - purchase_orders: ~3k records
#
class BackfillSearchData < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!  # Allow commits during batch processing

  BATCH_SIZE = 1000

  def up
    say_with_time "Backfilling corporate_company_documents searchable..." do
      backfill_table("corporate_company_documents")
    end

    say_with_time "Backfilling jobs searchable..." do
      backfill_table("jobs")
    end

    say_with_time "Backfilling contacts searchable..." do
      backfill_table("contacts")
    end

    say_with_time "Backfilling sm_tasks searchable..." do
      backfill_table("sm_tasks")
    end

    say_with_time "Backfilling purchase_orders searchable..." do
      backfill_table("purchase_orders")
    end

    # Note: email_warehouse is skipped because:
    # 1. It already has the searchable column populated via Rails callback
    # 2. 63k rows would take too long to update
    # 3. The data is already searchable, we just added the GIN index
    say "Skipping email_warehouse - already has searchable data"
  end

  def down
    # No-op: Searchable data will be regenerated on next update via triggers
    say "No rollback needed - triggers will repopulate on next update"
  end

  private

  def backfill_table(table_name)
    total = execute("SELECT COUNT(*) FROM #{table_name}").first["count"].to_i
    return 0 if total.zero?

    processed = 0
    offset = 0

    while offset < total
      # Batch update - touch records to fire trigger
      execute(<<-SQL.squish)
        UPDATE #{table_name}
        SET updated_at = NOW()
        WHERE id IN (
          SELECT id FROM #{table_name}
          ORDER BY id
          LIMIT #{BATCH_SIZE}
          OFFSET #{offset}
        )
      SQL

      offset += BATCH_SIZE
      processed = [offset, total].min
      say "  Processed #{processed}/#{total} records", true
    end

    total
  end
end
