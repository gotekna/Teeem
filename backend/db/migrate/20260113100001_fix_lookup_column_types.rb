# SSoT Fix: lookup_foundation_id determines lookup type
#
# This migration fixes columns where lookup_foundation_id was set but
# column_type was not correctly set to 'lookup' or 'multiple_lookups'.
# This caused frontend to render text inputs instead of dropdowns.
#
# The Column model now has a before_validation callback that auto-syncs
# column_type from lookup_foundation_id, preventing this bug from recurring.
class FixLookupColumnTypes < ActiveRecord::Migration[8.0]
  def up
    # Count before fixing
    mismatched_count = execute(<<-SQL).first["count"]
      SELECT COUNT(*) as count FROM columns
      WHERE lookup_foundation_id IS NOT NULL
      AND column_type NOT IN ('lookup', 'multiple_lookups', 'relation')
    SQL

    if mismatched_count.to_i > 0
      say "Found #{mismatched_count} columns with lookup_foundation_id but wrong column_type"

      # Fix columns with lookup_foundation_id but wrong column_type
      execute <<-SQL
        UPDATE columns
        SET column_type = CASE
          WHEN is_multiple = true THEN 'multiple_lookups'
          ELSE 'lookup'
        END,
        updated_at = NOW()
        WHERE lookup_foundation_id IS NOT NULL
        AND column_type NOT IN ('lookup', 'multiple_lookups', 'relation')
      SQL

      say "Fixed #{mismatched_count} columns - column_type now matches lookup_foundation_id"
    else
      say "No mismatched columns found - all lookup columns have correct column_type"
    end
  end

  def down
    # Cannot rollback - we don't know what the original column_type was
    say "Rollback not possible - original column_type values unknown"
  end
end
