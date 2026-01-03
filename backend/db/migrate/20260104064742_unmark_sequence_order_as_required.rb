class UnmarkSequenceOrderAsRequired < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    # sequence_order auto-generates, so not required in UI
    seq_col = foundation.columns.find_by(column_name: 'sequence_order')
    if seq_col&.required
      seq_col.update!(required: false)
      Rails.logger.info "Marked sequence_order as NOT required for sm-schedule-master (auto-generates)"
    end
  end

  def down
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    seq_col = foundation.columns.find_by(column_name: 'sequence_order')
    seq_col&.update!(required: true)
  end
end
