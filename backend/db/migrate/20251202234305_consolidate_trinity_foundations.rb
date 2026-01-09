class ConsolidateTrinityFoundations < ActiveRecord::Migration[8.0]
  def up
    # Consolidate Trinity Bible/Teacher/Lexicon into a single "Trinity" foundation
    # This must run BEFORE adding unique constraint on database_table_name

    # Find all trinity foundations (there may be 1 or 3 depending on environment)
    trinity_ids = execute("SELECT id FROM foundations WHERE database_table_name = 'trinity' ORDER BY id").to_a.map { |r| r['id'] }

    return if trinity_ids.empty?

    # Keep the first one (lowest ID), delete the rest
    keeper_id = trinity_ids.first
    ids_to_delete = trinity_ids[1..-1]

    if ids_to_delete.any?
      # Delete associated columns for duplicate foundations
      execute("DELETE FROM columns WHERE foundation_id IN (#{ids_to_delete.join(',')})")

      # Delete associated foundation_views for duplicate foundations
      execute("DELETE FROM foundation_views WHERE foundation_id IN (#{ids_to_delete.join(',')})")

      # Delete associated import_sessions for duplicate foundations
      execute("DELETE FROM import_sessions WHERE foundation_id IN (#{ids_to_delete.join(',')})")

      # Delete associated table_health_checks for duplicate foundations
      execute("DELETE FROM table_health_checks WHERE foundation_id IN (#{ids_to_delete.join(',')})")

      # Delete the duplicate foundations
      execute("DELETE FROM foundations WHERE id IN (#{ids_to_delete.join(',')})")
    end

    # Rename the keeper to just "Trinity"
    execute("UPDATE foundations SET name = 'Trinity', slug = 'trinity' WHERE id = #{keeper_id}")
  end

  def down
    # This migration cannot be reversed - data has been deleted
    # The trinity table records still exist with their category field intact
    raise ActiveRecord::IrreversibleMigration
  end
end
