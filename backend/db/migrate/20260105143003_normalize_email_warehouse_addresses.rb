class NormalizeEmailWarehouseAddresses < ActiveRecord::Migration[8.0]
  # SSoT: Normalize all email addresses to lowercase
  # FRC: This fixes the root cause of case-sensitive email matching
  # All new emails will be normalized via before_save callback
  def up
    say_with_time "Normalizing from_email to lowercase" do
      execute <<-SQL.squish
        UPDATE email_warehouses
        SET from_email = LOWER(from_email)
        WHERE from_email IS NOT NULL
          AND from_email != LOWER(from_email)
      SQL
    end

    say_with_time "Normalizing to_emails array to lowercase" do
      execute <<-SQL.squish
        UPDATE email_warehouses
        SET to_emails = (
          SELECT array_agg(LOWER(email))
          FROM unnest(to_emails) AS email
        )
        WHERE to_emails IS NOT NULL
          AND array_length(to_emails, 1) > 0
      SQL
    end

    say_with_time "Normalizing cc_emails array to lowercase" do
      execute <<-SQL.squish
        UPDATE email_warehouses
        SET cc_emails = (
          SELECT array_agg(LOWER(email))
          FROM unnest(cc_emails) AS email
        )
        WHERE cc_emails IS NOT NULL
          AND array_length(cc_emails, 1) > 0
      SQL
    end
  end

  def down
    # Cannot reverse - original case information is lost
    # This is acceptable as emails are case-insensitive by RFC 5321
    raise ActiveRecord::IrreversibleMigration
  end
end
