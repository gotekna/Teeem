# frozen_string_literal: true

# Change the unique index on corporate_directors to include position.
# Previously: UNIQUE(company_id, contact_id) WHERE is_current = true
# Now:        UNIQUE(company_id, contact_id, position) WHERE is_current = true
#
# This allows the same contact to hold multiple positions (director, secretary,
# public_officer) as separate records instead of one combined record.
#
# NOTE: The index was already updated on the production DB via rails runner
# before this migration was created. The migration is idempotent.
class ChangeCorporateDirectorsUniqueIndexToIncludePosition < ActiveRecord::Migration[8.0]
  def up
    # Split any combined position records before changing the index
    execute <<~SQL
      -- Find combined position records and split them
      DO $$
      DECLARE
        rec RECORD;
        pos TEXT;
        positions TEXT[];
      BEGIN
        FOR rec IN
          SELECT id, company_id, contact_id, tenant_id, position, appointment_date, is_current
          FROM corporate_directors
          WHERE position LIKE '%\\_%' AND position NOT IN ('public_officer', 'corporate_officer')
            AND is_current = true
        LOOP
          -- Split combined position into individual positions
          positions := string_to_array(rec.position, '_');
          -- Only process if it looks like a combined position (has known sub-positions)
          IF array_length(positions, 1) >= 2 AND 'director' = ANY(positions) THEN
            -- Delete the combined record
            DELETE FROM corporate_directors WHERE id = rec.id;
            -- Re-insert individual positions
            FOREACH pos IN ARRAY positions
            LOOP
              IF pos IN ('director', 'secretary', 'public_officer', 'corporate_officer', 'chairman') THEN
                INSERT INTO corporate_directors (company_id, contact_id, tenant_id, position, appointment_date, is_current, created_at, updated_at)
                VALUES (rec.company_id, rec.contact_id, rec.tenant_id, pos, rec.appointment_date, rec.is_current, NOW(), NOW())
                ON CONFLICT DO NOTHING;
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END $$;
    SQL

    # Drop old index and create new one
    remove_index :corporate_directors, name: :index_company_directors_unique_active, if_exists: true
    add_index :corporate_directors, [:company_id, :contact_id, :position],
              name: :index_company_directors_unique_active,
              unique: true,
              where: "(is_current = true)"
  end

  def down
    remove_index :corporate_directors, name: :index_company_directors_unique_active, if_exists: true
    add_index :corporate_directors, [:company_id, :contact_id],
              name: :index_company_directors_unique_active,
              unique: true,
              where: "(is_current = true)"
  end
end
