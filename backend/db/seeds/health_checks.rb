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

# Jobs health checks (foundation ID 204)
TableHealthCheck.find_or_create_by!(
  foundation_id: 204,
  check_type: 'missing_start_date'
) do |check|
  check.name = 'Jobs Without Start Date'
  check.description = 'Jobs that do not have a start date set. Start dates are needed for scheduling and project planning.'
  check.api_endpoint = '/api/v1/jobs/without_start_date'
  check.severity = 'warning'
  check.icon = 'calendar'
  check.action_path = '/jobs/:id'
  check.display_order = 0
end

TableHealthCheck.find_or_create_by!(
  foundation_id: 204,
  check_type: 'missing_contract_value'
) do |check|
  check.name = 'Jobs Without Contract Value'
  check.description = 'Jobs that do not have a contract value set. Contract values are needed for financial tracking and reporting.'
  check.api_endpoint = '/api/v1/jobs/without_contract_value'
  check.severity = 'info'
  check.icon = 'currency-dollar'
  check.action_path = '/jobs/:id'
  check.display_order = 1
end

# Companies health checks (foundation ID 353)
TableHealthCheck.find_or_create_by!(
  foundation_id: 353,
  check_type: 'missing_abn'
) do |check|
  check.name = 'Companies Without ABN'
  check.description = 'Companies that do not have an ABN recorded. ABN is required for tax compliance and invoicing.'
  check.api_endpoint = '/api/v1/companies/without_abn'
  check.severity = 'warning'
  check.icon = 'identification'
  check.action_path = '/companies/:id'
  check.display_order = 0
end

TableHealthCheck.find_or_create_by!(
  foundation_id: 353,
  check_type: 'missing_review_date'
) do |check|
  check.name = 'Companies Without Review Date'
  check.description = 'Companies that do not have a review date set. Review dates help ensure compliance documents are kept up to date.'
  check.api_endpoint = '/api/v1/companies/without_review_date'
  check.severity = 'info'
  check.icon = 'calendar'
  check.action_path = '/companies/:id'
  check.display_order = 1
end

# Company Documents health checks (foundation ID 357)
TableHealthCheck.find_or_create_by!(
  foundation_id: 357,
  check_type: 'needs_ai_verification'
) do |check|
  check.name = 'Documents Awaiting AI Verification'
  check.description = 'Documents that have not been analyzed by AI yet. AI verification helps ensure documents are correctly named and categorized.'
  check.api_endpoint = '/api/v1/company_documents/needs_ai_verification'
  check.severity = 'info'
  check.icon = 'sparkles'
  check.action_path = '/companies/:company_id/documents/:id'
  check.display_order = 0
end

TableHealthCheck.find_or_create_by!(
  foundation_id: 357,
  check_type: 'needs_user_validation'
) do |check|
  check.name = 'Documents Needing User Validation'
  check.description = 'Documents where AI has flagged potential issues that require human review and confirmation.'
  check.api_endpoint = '/api/v1/company_documents/needs_user_validation'
  check.severity = 'warning'
  check.icon = 'exclamation-circle'
  check.action_path = '/companies/:company_id/documents/:id'
  check.display_order = 1
end

puts "Created #{TableHealthCheck.count} health checks:"
TableHealthCheck.all.each do |check|
  identifier = check.table_name || "foundation:#{check.foundation_id}"
  puts "  - #{check.name} (#{identifier})"
end
