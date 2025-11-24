# Interactive Invoice Matching Demo
# Run this in Rails console: load 'test/invoice_matching_demo.rb'

puts "\n" + "="*80
puts "INVOICE MATCHING SERVICE - INTERACTIVE DEMO"
puts "="*80 + "\n"

# Test the extraction and normalization methods directly
service = InvoiceMatchingService.new({}, nil)

puts "1. Testing PO Number Extraction\n" + "-"*80

extraction_tests = [
  "PO-123456",
  "PO123456",
  "po-123456",
  "PO 123456",
  "P.O. 123456",
  "Purchase Order 123456",
  "Invoice for PO-123456 received",
  "PO-001",
  "P/O-789",
  "Order Ref: 456"
]

extraction_tests.each do |text|
  candidates = service.send(:extract_po_numbers, text)
  puts "  Input: '#{text}'"
  puts "  Extracted: #{candidates.inspect}"
  puts ""
end

puts "\n2. Testing PO Number Normalization\n" + "-"*80

normalization_tests = [
  "PO-000001",
  "PO-1",
  "PO-123",
  "PO-000123",
  "PO123456",
  "po-456",
  "Purchase Order 789"
]

normalization_tests.each do |text|
  normalized = service.send(:normalize_po_number, text)
  puts "  Input: '#{text}' → Normalized: #{normalized}"
end

puts "\n3. Pattern Matching Examples\n" + "-"*80

patterns = [
  { pattern: /PO[-\s]?\d+/i, description: "PO-123, PO 123, PO123" },
  { pattern: /P\.O\.?[-\s]?\d+/i, description: "P.O. 123, P.O.-123" },
  { pattern: /Purchase\s+Order[-\s]?\d+/i, description: "Purchase Order 123" },
  { pattern: /P\/O[-\s]?\d+/i, description: "P/O-123, P/O 123" }
]

test_strings = [
  "Invoice for PO-123456",
  "P.O. 789 - Materials",
  "Purchase Order 456",
  "Ref: P/O-999"
]

test_strings.each do |text|
  puts "  Testing: '#{text}'"
  patterns.each do |pattern_info|
    if text.match?(pattern_info[:pattern])
      match = text.match(pattern_info[:pattern])[0]
      puts "    ✓ Matched with #{pattern_info[:description]} → '#{match}'"
    end
  end
  puts ""
end

puts "\n4. Real-World Invoice Scenarios\n" + "-"*80

# Check if we have any POs to test with
po_count = PurchaseOrder.count
puts "Current PurchaseOrders in database: #{po_count}"

if po_count > 0
  sample_po = PurchaseOrder.first
  puts "\nTesting with real PO: #{sample_po.purchase_order_number}"

  # Test various invoice formats that should match this PO
  test_invoices = [
    {
      'InvoiceNumber' => sample_po.purchase_order_number,
      'InvoiceID' => 'TEST-001',
      'Total' => sample_po.total,
      'Date' => Time.current.to_s,
      'Contact' => { 'Name' => sample_po.supplier&.name || 'Test Supplier' }
    },
    {
      'InvoiceNumber' => "Invoice-#{rand(1000..9999)}",
      'Reference' => sample_po.purchase_order_number,
      'InvoiceID' => 'TEST-002',
      'Total' => sample_po.total,
      'Date' => Time.current.to_s,
      'Contact' => { 'Name' => sample_po.supplier&.name || 'Test Supplier' }
    }
  ]

  test_invoices.each_with_index do |invoice, idx|
    puts "\n  Test Invoice #{idx + 1}:"
    puts "    InvoiceNumber: #{invoice['InvoiceNumber']}"
    puts "    Reference: #{invoice['Reference']}" if invoice['Reference']
    puts "    Total: $#{invoice['Total']}"

    result = InvoiceMatchingService.call(invoice_data: invoice)

    if result[:success]
      puts "    ✓ SUCCESS: Matched to #{result[:purchase_order].purchase_order_number}"
      puts "    Payment Status: #{result[:payment_status]}"
    else
      puts "    ✗ FAILED: #{result[:error]}"
    end
  end
else
  puts "\nNo PurchaseOrders found in database. Create some POs to test real matching."
end

puts "\n" + "="*80
puts "Demo complete! Review the output above to see how different formats are handled."
puts "="*80 + "\n"

# Return help text
puts "\nTo run full automated tests, use:"
puts "  rails test:invoice_matching"
puts "\nTo test with custom data:"
puts "  invoice_data = { 'InvoiceNumber' => 'PO-123456', 'Total' => 1000, ... }"
puts "  result = InvoiceMatchingService.call(invoice_data: invoice_data)"
puts ""
