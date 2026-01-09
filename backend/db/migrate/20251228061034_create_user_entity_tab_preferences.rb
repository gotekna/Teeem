class CreateUserEntityTabPreferences < ActiveRecord::Migration[8.0]
  def change
    create_table :user_entity_tab_preferences do |t|
      t.references :user, null: false, foreign_key: true
      t.string :scope, null: false  # 'job', 'corporate_entity', 'people', etc.
      t.jsonb :hidden_tabs, default: []  # Array of tab_keys to hide
      t.string :default_tab  # tab_key of user's preferred default tab

      t.timestamps
    end

    add_index :user_entity_tab_preferences, [:user_id, :scope], unique: true, name: 'idx_user_entity_tab_prefs_unique'
  end
end
