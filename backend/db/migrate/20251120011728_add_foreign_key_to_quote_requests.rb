class AddForeignKeyToQuoteRequests < ActiveRecord::Migration[8.0]
  def change
    add_foreign_key :quote_requests, :quote_responses, column: :selected_quote_response_id
  end
end
