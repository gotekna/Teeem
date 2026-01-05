class AddIsPrimaryToMicrosoftCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :microsoft_credentials, :is_primary, :boolean, default: false, null: false

    # Set Tekna as the primary tenancy (can be changed via admin UI later)
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE microsoft_credentials
          SET is_primary = true
          WHERE name = 'Tekna' AND credential_type = 'app' AND is_active = true
        SQL
      end
    end
  end
end
