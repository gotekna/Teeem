class UpdateFoundationViewsContactTypesToRoles < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: 'contacts')
    return unless foundation

    foundation.foundation_views.each do |view|
      next unless view.columns.is_a?(Hash)

      # Update visible columns
      if view.columns['visible']&.key?('contact_types')
        view.columns['visible']['roles'] = view.columns['visible'].delete('contact_types')
      end

      # Update order array
      if view.columns['order']&.include?('contact_types')
        index = view.columns['order'].index('contact_types')
        view.columns['order'][index] = 'roles' if index
      end

      view.save!
    end
  end

  def down
    foundation = Foundation.find_by(slug: 'contacts')
    return unless foundation

    foundation.foundation_views.each do |view|
      next unless view.columns.is_a?(Hash)

      if view.columns['visible']&.key?('roles')
        view.columns['visible']['contact_types'] = view.columns['visible'].delete('roles')
      end

      if view.columns['order']&.include?('roles')
        index = view.columns['order'].index('roles')
        view.columns['order'][index] = 'contact_types' if index
      end

      view.save!
    end
  end
end
