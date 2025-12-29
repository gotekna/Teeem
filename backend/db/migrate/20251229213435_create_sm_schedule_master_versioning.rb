# frozen_string_literal: true

# World Class Schedule Master Architecture - Versioned Templates
#
# This migration adds versioning support to Schedule Master templates:
# 1. Creates SmScheduleMasterVersion table (draft/published/archived versions)
# 2. Links rows to versions (instead of directly to templates)
# 3. Links jobs to the template version they used
# 4. Links job types to their default template
#
# See: /Users/robertharder/.claude/plans/fuzzy-fluttering-cook.md
#
class CreateSmScheduleMasterVersioning < ActiveRecord::Migration[8.0]
  def change
    # 1. Create versions table
    create_table :sm_schedule_master_versions do |t|
      t.references :sm_schedule_master_template, null: false, foreign_key: true, index: { name: 'idx_sm_versions_template' }
      t.integer :version_number, null: false
      t.string :status, null: false, default: 'draft' # draft, published, archived
      t.datetime :published_at
      t.references :published_by, foreign_key: { to_table: :users }
      t.text :change_summary
      t.timestamps

      t.index [:sm_schedule_master_template_id, :version_number], unique: true, name: 'idx_sm_versions_template_number'
      t.index [:sm_schedule_master_template_id, :status], name: 'idx_sm_versions_template_status'
    end

    # 2. Add version_id to rows (sm_schedule_master)
    # Rows will belong to a specific version, not directly to template
    add_reference :sm_schedule_master, :sm_schedule_master_version,
                  foreign_key: true,
                  index: { name: 'idx_sm_rows_version' }

    # 3. Add copied_from_id to templates (for audit trail when copying)
    add_reference :sm_schedule_master_templates, :copied_from,
                  foreign_key: { to_table: :sm_schedule_master_templates },
                  index: { name: 'idx_sm_templates_copied_from' }

    # 4. Add template version to jobs (which version was applied)
    add_reference :jobs, :sm_template_version,
                  foreign_key: { to_table: :sm_schedule_master_versions },
                  index: { name: 'idx_jobs_template_version' }
    add_column :jobs, :template_applied_at, :datetime

    # 5. Add default template to job types (auto-selection)
    add_reference :job_types, :sm_schedule_master_template,
                  foreign_key: true,
                  index: { name: 'idx_job_types_template' }
  end
end
