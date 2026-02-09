# frozen_string_literal: true

# Drop 8 orphaned tables identified by dead column detector v2.
#
# These tables have NO model file, NO Foundation, and NO code references.
# 4 are empty, 4 have trivial/stale data:
#   - document_activities (0 rows) — old document tracking, replaced
#   - document_verification_feedbacks (0 rows) — old AI verification feedback
#   - job_people (0 rows) — replaced by job_contacts
#   - page_help_contents (0 rows) — replaced by page-help.json
#   - health_check_caches (37 rows) — ephemeral cache data
#   - user_job_tab_configs (18 rows) — old user preferences, unused
#   - xero_feature_tabs (17 rows) — migrated to entity_tabs (Dec 2025)
#   - table_protections (2 rows) — no code references
#
# See: notebooks/DEAD_COLUMNS_REPORT_2026-02-09.md
class DropOrphanedTables < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign keys first (for tables that have them)
    remove_foreign_key :document_activities, :users if foreign_key_exists?(:document_activities, :users)
    remove_foreign_key :document_verification_feedbacks, :users if foreign_key_exists?(:document_verification_feedbacks, :users)
    remove_foreign_key :job_people, :contacts if foreign_key_exists?(:job_people, :contacts)
    remove_foreign_key :job_people, :jobs if foreign_key_exists?(:job_people, :jobs)
    remove_foreign_key :page_help_contents, :users, column: :last_updated_by_id if foreign_key_exists?(:page_help_contents, column: :last_updated_by_id)
    remove_foreign_key :user_job_tab_configs, :job_tabs if foreign_key_exists?(:user_job_tab_configs, :job_tabs)
    if foreign_key_exists?(:user_job_tab_configs, column: :parent_job_tab_id)
      remove_foreign_key :user_job_tab_configs, column: :parent_job_tab_id
    end
    remove_foreign_key :user_job_tab_configs, :users if foreign_key_exists?(:user_job_tab_configs, :users)

    drop_table :document_activities
    drop_table :document_verification_feedbacks
    drop_table :job_people
    drop_table :page_help_contents
    drop_table :health_check_caches
    drop_table :user_job_tab_configs
    drop_table :xero_feature_tabs
    drop_table :table_protections
  end

  def down
    create_table :document_activities do |t|
      t.bigint :company_document_id, null: false
      t.bigint :user_id
      t.string :action, null: false
      t.jsonb :old_values, default: {}
      t.jsonb :new_values, default: {}
      t.text :notes
      t.timestamps
      t.index :action
      t.index :company_document_id
      t.index :created_at
      t.index :user_id
    end
    add_foreign_key :document_activities, :users

    create_table :document_verification_feedbacks do |t|
      t.bigint :company_document_id, null: false
      t.bigint :user_id, null: false
      t.string :ai_suggested_name
      t.string :ai_suggested_folder
      t.string :ai_suggested_type
      t.string :ai_suggested_fy
      t.integer :ai_confidence
      t.string :user_final_name
      t.string :user_final_folder
      t.string :user_final_type
      t.string :user_final_fy
      t.string :action, null: false
      t.text :rejection_reason
      t.text :document_text_snippet
      t.string :company_code
      t.timestamps
      t.index :action
      t.index [:company_code, :action], name: "idx_on_company_code_action_af023a5fcb"
      t.index :company_code
      t.index :company_document_id
      t.index :user_id
    end
    add_foreign_key :document_verification_feedbacks, :users

    create_table :job_people do |t|
      t.bigint :job_id, null: false
      t.bigint :contact_id, null: false
      t.string :role
      t.text :notes
      t.boolean :is_primary, default: false, null: false
      t.timestamps
      t.index :contact_id
      t.index [:job_id, :contact_id], unique: true
      t.index [:job_id, :is_primary]
      t.index :job_id
    end
    add_foreign_key :job_people, :contacts
    add_foreign_key :job_people, :jobs

    create_table :page_help_contents do |t|
      t.string :route_pattern, null: false
      t.string :title, null: false
      t.text :description
      t.text :quick_tips
      t.text :common_tasks
      t.text :related_pages
      t.integer :chapter_number
      t.string :video_url
      t.boolean :is_active, default: true, null: false
      t.bigint :last_updated_by_id
      t.timestamps
      t.index :is_active
      t.index :last_updated_by_id
      t.index :route_pattern, unique: true
    end
    add_foreign_key :page_help_contents, :users, column: :last_updated_by_id

    create_table :health_check_caches do |t|
      t.integer :foundation_id
      t.string :check_type
      t.jsonb :results
      t.datetime :last_run_at
      t.timestamps
    end

    create_table :user_job_tab_configs do |t|
      t.bigint :user_id, null: false
      t.bigint :job_tab_id, null: false
      t.integer :position, default: 0, null: false
      t.integer :parent_job_tab_id
      t.boolean :is_hidden, default: false
      t.timestamps
      t.index :job_tab_id
      t.index [:user_id, :job_tab_id], unique: true, name: "idx_user_job_tab_config_unique"
      t.index [:user_id, :parent_job_tab_id]
      t.index [:user_id, :position]
      t.index :user_id
    end
    add_foreign_key :user_job_tab_configs, :job_tabs
    add_foreign_key :user_job_tab_configs, :job_tabs, column: :parent_job_tab_id
    add_foreign_key :user_job_tab_configs, :users

    create_table :xero_feature_tabs do |t|
      t.string :tab_key, null: false
      t.string :display_name, null: false
      t.string :tab_group, default: "data"
      t.integer :order_position, default: 0
      t.boolean :enabled, default: true
      t.string :component_name
      t.string :icon_name
      t.text :description
      t.timestamps
      t.boolean :group_member, default: false, null: false
      t.string :parent_key
      t.boolean :visible, default: true, null: false
      t.index :enabled
      t.index :order_position
      t.index :tab_key, unique: true
    end

    create_table :table_protections do |t|
      t.string :table_name, null: false
      t.boolean :is_protected, default: true, null: false
      t.text :description
      t.timestamps
      t.index :table_name, unique: true
    end
  end
end
