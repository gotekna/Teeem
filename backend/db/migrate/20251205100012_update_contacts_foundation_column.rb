class UpdateContactsFoundationColumn < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: 'contacts')
    return unless foundation

    column = foundation.columns.find_by(column_name: 'contact_types')
    if column
      column.update!(
        column_name: 'roles',
        name: 'Roles'
      )
    end
  end

  def down
    foundation = Foundation.find_by(slug: 'contacts')
    return unless foundation

    column = foundation.columns.find_by(column_name: 'roles')
    if column
      column.update!(
        column_name: 'contact_types',
        name: 'Contact Types'
      )
    end
  end
end
