class PopulateDwellingTypeChoices < ActiveRecord::Migration[8.0]
  def up
    # Find the dwelling_type column in the Jobs foundation
    dwelling_column = Column.joins(:foundation)
                            .where(foundations: { slug: 'jobs' })
                            .where(column_name: 'dwelling_type')
                            .first

    return unless dwelling_column

    # NCC Building Classification choices
    ncc_classes = [
      'Class 1A',
      'Class 1B',
      'Class 2',
      'Class 3',
      'Class 4',
      'Class 5',
      'Class 6',
      'Class 7A',
      'Class 7B',
      'Class 8',
      'Class 9A',
      'Class 9B',
      'Class 9C',
      'Class 10A',
      'Class 10B',
      'Class 10C'
    ]

    # Merge with existing choices to preserve any custom ones
    existing_choices = dwelling_column.available_choices || []
    merged_choices = (existing_choices + ncc_classes).uniq

    dwelling_column.update!(available_choices: merged_choices)
  end

  def down
    # No-op - don't remove choices on rollback
  end
end
