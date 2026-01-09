class MarkSmScheduleMasterColumnsRequired < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    # These columns have model validations (presence: true) so UI should reflect that
    # Note: sequence_order auto-generates so not marked required in UI
    required_columns = %w[duration_days sm_template_ids]

    required_columns.each do |col_name|
      col = foundation.columns.find_by(column_name: col_name)
      if col && !col.required
        col.update!(required: true)
        Rails.logger.info "Marked #{col_name} as required for sm-schedule-master"
      end
    end

    # Ensure sequence_order is NOT required since it auto-generates
    seq_col = foundation.columns.find_by(column_name: 'sequence_order')
    if seq_col&.required
      seq_col.update!(required: false)
      Rails.logger.info "Marked sequence_order as NOT required (auto-generates)"
    end
  end

  def down
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    %w[duration_days sm_template_ids].each do |col_name|
      col = foundation.columns.find_by(column_name: col_name)
      col&.update!(required: false)
    end
  end
end
