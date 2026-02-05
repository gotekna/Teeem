# frozen_string_literal: true

# Migration: Change Quote Tracker contact_id to reference ContactPerson
#
# The contact_id column should reference contact_persons (employees of a supplier)
# not contacts (companies). This fixes the foreign key and updates the Foundation
# column configuration.
#
class ChangeQuoteTrackerContactToContactPerson < ActiveRecord::Migration[8.0]
  def up
    # Remove old foreign key to contacts
    remove_foreign_key :quote_trackers, column: :contact_id

    # Add new foreign key to contact_persons
    add_foreign_key :quote_trackers, :contact_persons, column: :contact_id

    # Update Column lookup configuration
    contact_persons_foundation = execute(<<-SQL.squish).first
      SELECT id FROM foundations WHERE slug = 'contact_persons'
    SQL

    if contact_persons_foundation
      execute(<<-SQL.squish)
        UPDATE columns
        SET lookup_foundation_id = #{contact_persons_foundation['id']},
            lookup_display_column = 'first_name'
        WHERE foundation_id = (SELECT id FROM foundations WHERE slug = 'quote-tracker')
          AND column_name = 'contact_id'
      SQL
    end

    puts "[ChangeQuoteTrackerContactToContactPerson] Updated contact_id to reference contact_persons"
  end

  def down
    # Remove foreign key to contact_persons
    remove_foreign_key :quote_trackers, column: :contact_id

    # Restore foreign key to contacts
    add_foreign_key :quote_trackers, :contacts, column: :contact_id

    # Restore Column lookup configuration
    contacts_foundation = execute(<<-SQL.squish).first
      SELECT id FROM foundations WHERE slug = 'contacts'
    SQL

    if contacts_foundation
      execute(<<-SQL.squish)
        UPDATE columns
        SET lookup_foundation_id = #{contacts_foundation['id']},
            lookup_display_column = 'display_name'
        WHERE foundation_id = (SELECT id FROM foundations WHERE slug = 'quote-tracker')
          AND column_name = 'contact_id'
      SQL
    end
  end
end
