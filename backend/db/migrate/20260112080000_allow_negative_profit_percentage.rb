class AllowNegativeProfitPercentage < ActiveRecord::Migration[8.0]
  def up
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    column = Column.find_by(foundation_id: jobs_foundation.id, column_name: 'profit_percentage')
    return unless column

    # Use override_min_value which takes precedence over column_type_definition.default_min_value
    # This allows negative profit percentages (losses) while keeping the percentage type defaults
    column.update!(override_min_value: -100)
  end

  def down
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    column = Column.find_by(foundation_id: jobs_foundation.id, column_name: 'profit_percentage')
    return unless column

    column.update!(override_min_value: nil)
  end
end
