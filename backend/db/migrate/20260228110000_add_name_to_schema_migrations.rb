# frozen_string_literal: true

# FRC (Feb 2026): Rails 8 expects a 'name' column on schema_migrations
# that stores migration filenames. Production DB was created with Rails 7
# and doesn't have this column, causing PG::UndefinedColumn errors on boot.
#
# Sentry: TEEEM-BACKEND-5V (4 events)
class AddNameToSchemaMigrations < ActiveRecord::Migration[8.0]
  def up
    add_column :schema_migrations, :name, :string, if_not_exists: true
  end

  def down
    remove_column :schema_migrations, :name, if_exists: true
  end
end
