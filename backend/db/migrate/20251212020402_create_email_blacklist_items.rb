class CreateEmailBlacklistItems < ActiveRecord::Migration[8.0]
  def change
    create_table :email_blacklist_items do |t|
      t.string :pattern, null: false
      t.string :pattern_type, null: false # from_email, subject, domain, sender_name
      t.text :description
      t.boolean :active, default: true, null: false
      t.integer :match_count, default: 0 # Track how many emails matched this pattern

      t.timestamps
    end

    add_index :email_blacklist_items, [ :pattern, :pattern_type ], unique: true
    add_index :email_blacklist_items, :active

    # Seed with existing hardcoded patterns
    reversible do |dir|
      dir.up do
        # From email patterns
        [
          "marketing@",
          "promo@",
          "newsletter@",
          "noreply@",
          "no-reply@"
        ].each do |pattern|
          execute <<-SQL
            INSERT INTO email_blacklist_items (pattern, pattern_type, description, active, created_at, updated_at)
            VALUES ('#{pattern}', 'from_email', 'Marketing/automated email pattern', true, NOW(), NOW());
          SQL
        end

        # Subject patterns
        [
          "unsubscribe",
          "opt out",
          "opt-out",
          "manage preferences",
          "view in browser"
        ].each do |pattern|
          execute <<-SQL
            INSERT INTO email_blacklist_items (pattern, pattern_type, description, active, created_at, updated_at)
            VALUES ('#{pattern}', 'subject', 'Marketing email subject pattern', true, NOW(), NOW());
          SQL
        end
      end
    end
  end
end
