class AddSmartFitToSavedViews < ActiveRecord::Migration[7.0]
  def change
    add_column :saved_views, :smart_fit, :boolean, default: true, null: false

    # Migrate existing views to smart fit
    reversible do |dir|
      dir.up do
        # Set smart_fit to true for all existing views
        SavedView.update_all(smart_fit: true)

        # Turn off auto_fit_columns where it was enabled
        execute <<-SQL
          UPDATE saved_views
          SET columns = jsonb_set(
            COALESCE(columns, '{}'::jsonb),
            '{autoFitColumns}',
            'false'
          )
          WHERE columns->>'autoFitColumns' = 'true'
        SQL
      end
    end
  end
end
