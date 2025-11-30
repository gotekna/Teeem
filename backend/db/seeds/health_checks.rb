# Seed health checks for the Universal Table Health System

puts "Seeding health checks..."

# Contacts table health checks
TableHealthCheck.find_or_create_by!(
  table_name: 'contacts',
  check_type: 'duplicates'
) do |check|
  check.name = 'Duplicate Contacts'
  check.description = 'Contacts with matching names that may need to be merged. Duplicate contacts can cause confusion in quotes, jobs, and reporting.'
  check.api_endpoint = '/api/v1/contacts/possible_duplicates'
  check.severity = 'warning'
  check.icon = 'users'
  check.action_path = '/contacts/:id'
  check.display_order = 0
end

# Pricebook health checks (foundation ID 205)
TableHealthCheck.find_or_create_by!(
  foundation_id: 205,
  check_type: 'missing_supplier'
) do |check|
  check.name = 'Items Without Default Supplier'
  check.description = 'Pricebook items that do not have a default supplier assigned. These items cannot be quoted until a supplier is set.'
  check.api_endpoint = '/api/v1/pricebook_items/without_default_supplier'
  check.severity = 'warning'
  check.icon = 'building-storefront'
  check.action_path = '/price-books/:id'
  check.display_order = 0
end

TableHealthCheck.find_or_create_by!(
  foundation_id: 205,
  check_type: 'missing_price_history'
) do |check|
  check.name = 'Items Without Price History'
  check.description = 'Items with a default supplier but no price history records. Price history is needed for tracking costs over time.'
  check.api_endpoint = '/api/v1/pricebook_items/without_price_history'
  check.severity = 'info'
  check.icon = 'clock'
  check.action_path = '/price-books/:id'
  check.display_order = 1
end

TableHealthCheck.find_or_create_by!(
  foundation_id: 205,
  check_type: 'missing_photos'
) do |check|
  check.name = 'Items Missing Required Photos'
  check.description = 'Items marked as requiring a photo but without an image uploaded. Photos help identify items during quotes and on-site.'
  check.api_endpoint = '/api/v1/pricebook_items/missing_photos'
  check.severity = 'info'
  check.icon = 'photo'
  check.action_path = '/price-books/:id'
  check.display_order = 2
end

puts "Created #{TableHealthCheck.count} health checks:"
TableHealthCheck.all.each do |check|
  identifier = check.table_name || "foundation:#{check.foundation_id}"
  puts "  - #{check.name} (#{identifier})"
end
