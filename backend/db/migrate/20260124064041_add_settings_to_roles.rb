# frozen_string_literal: true

# Add settings JSONB column to roles table for configurable role defaults
# Settings include: default_task_view, default_theme, sidebar_collapsed
class AddSettingsToRoles < ActiveRecord::Migration[7.2]
  def up
    add_column :roles, :settings, :jsonb, default: {}, null: false

    # Seed existing roles with defaults based on their role type
    # Supervisor role defaults to 'list' view (needs full task details)
    # Other roles default to 'board' view (quick overview)
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE roles
          SET settings = '{"default_task_view": "list"}'::jsonb
          WHERE name = 'supervisor';
        SQL

        execute <<-SQL
          UPDATE roles
          SET settings = '{"default_task_view": "board"}'::jsonb
          WHERE name != 'supervisor' AND settings = '{}'::jsonb;
        SQL
      end
    end
  end

  def down
    remove_column :roles, :settings
  end
end
