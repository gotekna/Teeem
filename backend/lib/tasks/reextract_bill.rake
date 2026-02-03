# frozen_string_literal: true

namespace :bills do
  desc "Re-extract a bill by ID"
  task :reextract, [:id] => :environment do |_t, args|
    bill_id = args[:id].to_i
    raise "Bill ID required" if bill_id.zero?

    bill = BillInbox.find(bill_id)
    puts "Re-extracting bill ##{bill_id}..."

    result = bill.extract_invoice_data!
    bill.reload

    puts "Done!"
    puts "  corporate_company_id: #{bill.corporate_id}"
    puts "  billing_company_name: #{result['billing_company_name']}"
    puts "  field_locations present: #{result['field_locations'].present?}"
    puts "  field_locations keys: #{result['field_locations']&.keys&.join(', ')}"
  end
end
