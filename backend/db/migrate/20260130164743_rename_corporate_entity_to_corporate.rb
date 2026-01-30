# frozen_string_literal: true

# SSoT: Rename 'corporate_entity' to 'corporate' (Jan 2026)
# FRC: Having two names for the same thing violates SSoT
# 'corporate' is the canonical name going forward
class RenameCorporateEntityToCorporate < ActiveRecord::Migration[8.0]
  def up
    # Rename in entity_tabs (StorageLocation model)
    execute <<-SQL.squish
      UPDATE entity_tabs
      SET warehouse_type = 'corporate'
      WHERE warehouse_type = 'corporate_entity'
    SQL
  end

  def down
    # Revert to legacy name
    execute <<-SQL.squish
      UPDATE entity_tabs
      SET warehouse_type = 'corporate_entity'
      WHERE warehouse_type = 'corporate'
    SQL
  end
end
