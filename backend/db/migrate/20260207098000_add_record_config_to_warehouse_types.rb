# frozen_string_literal: true

# Config-driven warehouse records (Feb 2026)
#
# Moves all per-type record config (query, display, search, tokens)
# from hardcoded case/when in the controller to JSONB columns on warehouse_types.
# The controller becomes 100% generic — zero case/when.
#
# Columns:
#   source_model  - ActiveRecord model class name (nil = type has no records, e.g. email)
#   token_config  - Token name → attribute dot-path for template resolution
#   records_config - Display, search, ordering config
class AddRecordConfigToWarehouseTypes < ActiveRecord::Migration[8.0]
  def up
    add_column :warehouse_types, :source_model, :string
    add_column :warehouse_types, :token_config, :jsonb, null: false, default: {}
    add_column :warehouse_types, :records_config, :jsonb, null: false, default: {}

    seed_existing_warehouse_types
  end

  def down
    remove_column :warehouse_types, :source_model
    remove_column :warehouse_types, :token_config
    remove_column :warehouse_types, :records_config
  end

  private

  # rubocop:disable Metrics/MethodLength
  def seed_existing_warehouse_types
    seeds = {
      'job' => {
        source_model: 'Job',
        token_config: {
          'JobCode' => 'job_code',
          'JobName' => 'name',
          'JobStatus' => 'job_status.name',
          'JobType' => 'job_type.name'
        },
        records_config: {
          'display' => { 'name' => 'name', 'subtitle' => 'location', 'code' => 'job_code' },
          'search' => %w[name job_code],
          'order' => 'created_at DESC'
        }
      },
      'corporate' => {
        source_model: 'Corporate',
        token_config: {
          'CompanyCode' => 'code',
          'CompanyName' => 'display_name',
          'CompanyGroup' => 'company_group.name'
        },
        records_config: {
          'display' => { 'name' => 'display_name', 'subtitle' => 'company_group.name' },
          'search' => %w[corporates.name corporates.code],
          'order' => 'corporates.name ASC'
        }
      },
      'task' => {
        source_model: 'SmTask',
        token_config: {
          'TaskId' => 'warehouse_task_id',
          'TaskName' => 'name',
          'JobCode' => 'job.job_code',
          'JobName' => 'warehouse_job_label'
        },
        records_config: {
          'display' => { 'name' => 'name', 'subtitle' => 'description', 'code' => 'warehouse_task_id' },
          'search' => %w[sm_tasks.name sm_tasks.description],
          'order' => 'created_at DESC'
        }
      },
      'contact' => {
        source_model: 'Contact',
        token_config: {
          'ContactName' => 'display_name'
        },
        records_config: {
          'display' => { 'name' => 'display_name', 'subtitle' => 'company_name_or_trust' },
          'search' => %w[display_name first_name last_name],
          'order' => 'display_name ASC'
        }
      },
      'user' => {
        source_model: 'User',
        token_config: {
          'UserName' => 'name'
        },
        records_config: {
          'display' => { 'name' => 'name', 'subtitle' => 'email' },
          'search' => %w[name email],
          'order' => 'name ASC'
        }
      }
    }
    # email, document, template, etc. → source_model: nil (no records endpoint)

    seeds.each do |code, config|
      # Use raw SQL to avoid model validations during migration
      execute <<~SQL.squish
        UPDATE warehouse_types
        SET source_model = #{quote(config[:source_model])},
            token_config = #{quote(config[:token_config].to_json)}::jsonb,
            records_config = #{quote(config[:records_config].to_json)}::jsonb
        WHERE code = #{quote(code)}
      SQL
    end
  end
  # rubocop:enable Metrics/MethodLength

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end
