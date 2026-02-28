# frozen_string_literal: true

# FRC (Feb 2026): Rails 8 expects a 'name' column on schema_migrations
# that stores migration filenames. Production DB was created with Rails 7
# and doesn't have this column, causing PG::UndefinedColumn errors on boot.
#
# Sentry: TEEEM-BACKEND-5V (4 events)
class AddNameToSchemaMigrations < ActiveRecord::Migration[8.0]
  def up
    unless column_exists?(:schema_migrations, :name)
      add_column :schema_migrations, :name, :string
    end
  end

  def down
    remove_column :schema_migrations, :name if column_exists?(:schema_migrations, :name)
  end
end
