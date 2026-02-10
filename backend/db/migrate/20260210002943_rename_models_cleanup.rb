# frozen_string_literal: true

# Atomic migration: rename 5 models + delete 1 legacy model
#
# Renames:
#   1. unreal_measurements → takeoff_measurements (first, because docsort FK rename depends on it)
#   2. people_documents → contact_documents
#   3. versions → app_versions
#   4. designs → job_designs
#   5. docsort_items → document_inboxes
#
# Deletion:
#   6. projects (legacy, replaced by Job + SmTask)
#
# Order matters: rename unreal_measurements before docsort_items because
# docsort_items FK columns reference unreal_measurements table.
#
class RenameModelsCleanup < ActiveRecord::Migration[7.1]
  def up
    # =========================================================================
    # 1. Rename unreal_measurements → takeoff_measurements
    # =========================================================================
    rename_table :unreal_measurements, :takeoff_measurements

    # Self-referential FK: parent_measurement_id still points to same table (just renamed)
    # Foreign key on takeoff_room_slots.measurement_id needs updating
    if foreign_key_exists?(:takeoff_room_slots, :unreal_measurements, column: :measurement_id)
      remove_foreign_key :takeoff_room_slots, :unreal_measurements, column: :measurement_id
      add_foreign_key :takeoff_room_slots, :takeoff_measurements, column: :measurement_id
    end

    # =========================================================================
    # 2. Rename people_documents → contact_documents
    # =========================================================================
    rename_table :people_documents, :contact_documents

    # Update polymorphic type references in document_duplicate_reviews (if columns exist)
    if column_exists?(:document_duplicate_reviews, :existing_document_type)
      execute <<-SQL
        UPDATE document_duplicate_reviews
        SET existing_document_type = 'ContactDocument'
        WHERE existing_document_type = 'PeopleDocument'
      SQL
    end
    if column_exists?(:document_duplicate_reviews, :new_document_type)
      execute <<-SQL
        UPDATE document_duplicate_reviews
        SET new_document_type = 'ContactDocument'
        WHERE new_document_type = 'PeopleDocument'
      SQL
    end

    # Update polymorphic type in warehouse_documents (documentable_type)
    execute <<-SQL
      UPDATE warehouse_documents
      SET documentable_type = 'ContactDocument'
      WHERE documentable_type = 'PeopleDocument'
    SQL

    # =========================================================================
    # 3. Rename versions → app_versions
    # =========================================================================
    rename_table :versions, :app_versions

    # =========================================================================
    # 4. Rename designs → job_designs
    # =========================================================================
    rename_table :designs, :job_designs

    # Note: design_id was already removed from jobs table in migration
    # 20251211001112_remove_unused_columns_from_jobs.rb - no FK rename needed

    # =========================================================================
    # 5. Rename docsort_items → document_inboxes
    # =========================================================================
    rename_table :docsort_items, :document_inboxes

    # Rename FK columns on associated tables
    rename_column :takeoff_measurements, :docsort_item_id, :document_inbox_id
    rename_column :takeoff_layers, :docsort_item_id, :document_inbox_id
    rename_column :takeoff_room_instances, :docsort_item_id, :document_inbox_id
    rename_column :page_scales, :docsort_item_id, :document_inbox_id

    # =========================================================================
    # 6. Delete Project (legacy)
    # =========================================================================
    # Remove FK from chat_messages first
    if foreign_key_exists?(:chat_messages, :projects)
      remove_foreign_key :chat_messages, :projects
    end
    remove_column :chat_messages, :project_id, if_exists: true

    # Remove FKs from projects table
    if foreign_key_exists?(:projects, :jobs)
      remove_foreign_key :projects, :jobs
    end
    if foreign_key_exists?(:projects, :users, column: :project_manager_id)
      remove_foreign_key :projects, :users, column: :project_manager_id
    end

    drop_table :projects
  end

  def down
    # =========================================================================
    # 6. Recreate Project
    # =========================================================================
    create_table :projects do |t|
      t.string :name, null: false
      t.string :project_code
      t.text :description
      t.date :start_date
      t.date :planned_end_date
      t.date :actual_end_date
      t.string :status, default: "planning"
      t.string :client_name
      t.text :site_address
      t.bigint :project_manager_id, null: false
      t.bigint :job_id, null: false
      t.datetime :generated_at
      t.timestamps
    end
    add_index :projects, :job_id
    add_index :projects, :project_code, unique: true
    add_index :projects, :project_manager_id
    add_index :projects, [:start_date, :planned_end_date]
    add_index :projects, :status
    add_foreign_key :projects, :jobs
    add_foreign_key :projects, :users, column: :project_manager_id
    add_column :chat_messages, :project_id, :bigint
    add_foreign_key :chat_messages, :projects

    # =========================================================================
    # 5. Revert docsort rename
    # =========================================================================
    rename_column :page_scales, :document_inbox_id, :docsort_item_id
    rename_column :takeoff_room_instances, :document_inbox_id, :docsort_item_id
    rename_column :takeoff_layers, :document_inbox_id, :docsort_item_id
    rename_column :takeoff_measurements, :document_inbox_id, :docsort_item_id
    rename_table :document_inboxes, :docsort_items

    # =========================================================================
    # 4. Revert designs rename
    # =========================================================================
    rename_table :job_designs, :designs

    # =========================================================================
    # 3. Revert versions rename
    # =========================================================================
    rename_table :app_versions, :versions

    # =========================================================================
    # 2. Revert people_documents rename
    # =========================================================================
    execute <<-SQL
      UPDATE warehouse_documents
      SET documentable_type = 'PeopleDocument'
      WHERE documentable_type = 'ContactDocument'
    SQL
    if column_exists?(:document_duplicate_reviews, :existing_document_type)
      execute <<-SQL
        UPDATE document_duplicate_reviews
        SET existing_document_type = 'PeopleDocument'
        WHERE existing_document_type = 'ContactDocument'
      SQL
    end
    if column_exists?(:document_duplicate_reviews, :new_document_type)
      execute <<-SQL
        UPDATE document_duplicate_reviews
        SET new_document_type = 'PeopleDocument'
        WHERE new_document_type = 'ContactDocument'
      SQL
    end
    rename_table :contact_documents, :people_documents

    # =========================================================================
    # 1. Revert unreal_measurements rename
    # =========================================================================
    if foreign_key_exists?(:takeoff_room_slots, :takeoff_measurements, column: :measurement_id)
      remove_foreign_key :takeoff_room_slots, :takeoff_measurements, column: :measurement_id
      add_foreign_key :takeoff_room_slots, :unreal_measurements, column: :measurement_id
    end
    rename_table :takeoff_measurements, :unreal_measurements
  end
end
