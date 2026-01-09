# SSoT: Fix tab_key uniqueness to allow same tab_key under different parents
# This allows child tabs under different parent tabs to have the same display_name
# (e.g., "Site" under Documents vs "Site" under Photos)
class FixEntityTabKeyUniquenessIndex < ActiveRecord::Migration[8.0]
  def change
    # Remove old index that doesn't include parent_id
    remove_index :entity_tabs, name: :idx_entity_tabs_unique_key, if_exists: true

    # Add new index that includes parent_id for proper scoping
    add_index :entity_tabs,
              [:scope, :tab_key, :job_id, :parent_id],
              unique: true,
              name: :idx_entity_tabs_unique_key
  end
end
