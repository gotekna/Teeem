class DeleteCourageQuotes < ActiveRecord::Migration[7.1]
  def up
    count = InspiringQuote.where(category: "Courage").count
    InspiringQuote.where(category: "Courage").destroy_all
    puts "Deleted #{count} Courage category quotes"
  end

  def down
    puts "Cannot restore deleted quotes"
  end
end
