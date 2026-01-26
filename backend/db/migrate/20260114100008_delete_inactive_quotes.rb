class DeleteInactiveQuotes < ActiveRecord::Migration[7.1]
  def up
    count = InspiringQuote.where(is_active: false).count
    InspiringQuote.where(is_active: false).destroy_all
    puts "Permanently deleted #{count} inactive quotes"
  end

  def down
    # Cannot restore deleted quotes - they are gone
    puts "Cannot restore deleted quotes - migration is irreversible"
  end
end
