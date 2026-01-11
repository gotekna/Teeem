class AddLookupFilterToColumns < ActiveRecord::Migration[8.0]
  def up
    add_column :columns, :lookup_filter, :jsonb, default: {}

    # Set role filters for internal team columns on Jobs
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    role_mapping = {
      'supervisor_id' => 'supervisor',
      'site_coordinator_id' => 'site_coordinator',
      'estimator_id' => 'estimator',
      'internal_sales_id' => 'sales',
      'client_coordinator_id' => 'client_coordinator'
    }

    role_mapping.each do |column_name, role_name|
      column = Column.find_by(foundation_id: jobs_foundation.id, column_name: column_name)
      next unless column

      column.update!(lookup_filter: { role: role_name })
    end
  end

  def down
    remove_column :columns, :lookup_filter
  end
end
