class FixHeaderGanttColumnType < ActiveRecord::Migration[8.0]
  def up
    # Fix header_gantt column to be a self-referential lookup
    # It stores IDs pointing to other SmScheduleMaster records (headers like SLAB, FRAME, etc.)
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    column = foundation.columns.find { |c| c.name.downcase.include?('header') && c.name.downcase.include?('gantt') }
    return unless column

    column.update!(
      column_type: 'lookup',
      lookup_foundation_id: foundation.id,
      lookup_foundation_slug: foundation.slug,
      lookup_display_column: 'name'
    )

    Rails.logger.info "Fixed header_gantt column (ID: #{column.id}) to be a lookup type"
  end

  def down
    # Revert to single_line_text
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    return unless foundation

    column = foundation.columns.find { |c| c.name.downcase.include?('header') && c.name.downcase.include?('gantt') }
    return unless column

    column.update!(
      column_type: 'single_line_text',
      lookup_foundation_id: nil,
      lookup_foundation_slug: nil,
      lookup_display_column: nil
    )
  end
end
