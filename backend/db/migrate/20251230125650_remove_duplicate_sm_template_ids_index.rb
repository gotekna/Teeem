class RemoveDuplicateSmTemplateIdsIndex < ActiveRecord::Migration[8.0]
  def up
    # SSoT cleanup: Remove duplicate GIN index on sm_template_ids
    # Keep: index_sm_schedule_master_on_sm_template_ids_gin
    # Drop: index_sm_schedule_masters_on_sm_template_ids (duplicate)
    remove_index :sm_schedule_masters, name: 'index_sm_schedule_masters_on_sm_template_ids'
  end

  def down
    add_index :sm_schedule_masters, :sm_template_ids,
              name: 'index_sm_schedule_masters_on_sm_template_ids',
              using: :gin
  end
end
