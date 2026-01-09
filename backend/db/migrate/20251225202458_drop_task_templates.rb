# frozen_string_literal: true

# SSoT Cleanup: TaskTemplate is redundant - SmTemplateRow is THE ONE
# for task definitions in Schedule Master.
class DropTaskTemplates < ActiveRecord::Migration[8.0]
  def up
    drop_table :task_templates if table_exists?(:task_templates)
  end

  def down
    # No rollback - this is intentional SSoT cleanup
    raise ActiveRecord::IrreversibleMigration, "TaskTemplate was redundant with SmTemplateRow"
  end
end
