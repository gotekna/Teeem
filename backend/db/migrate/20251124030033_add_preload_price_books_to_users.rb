class AddPreloadPriceBooksToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :preload_price_books, :boolean, default: false, null: false
  end
end
