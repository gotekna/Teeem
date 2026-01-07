# Seed Trading Names Foundation
puts "Seeding Trading Names..."

# Create Trading Names Foundation
f = Foundation.find_or_create_by!(slug: 'trading_names') do |foundation|
  foundation.name = 'Trading Names'
  foundation.description = 'Company trading names for invoices and documents'
  foundation.database_table_name = 'foundation_trading_names'
  foundation.icon = 'Building2'
end
puts "  Foundation: #{f.name}"

# Create the table if it doesn't exist
unless ActiveRecord::Base.connection.table_exists?('foundation_trading_names')
  ActiveRecord::Base.connection.create_table :foundation_trading_names do |t|
    t.string :name, null: false
    t.string :abn
    t.string :address
    t.boolean :is_default, default: false
    t.boolean :is_active, default: true
    t.timestamps
  end
  puts "  Created table: foundation_trading_names"
end

# Add default trading names
[
  { name: 'Tekna Homes', is_default: true },
  { name: 'Tekna Group Pty Ltd', is_default: false },
  { name: 'Tekna Construction', is_default: false }
].each do |data|
  existing = ActiveRecord::Base.connection.execute(
    "SELECT id FROM foundation_trading_names WHERE name = '#{data[:name]}'"
  ).first

  unless existing
    ActiveRecord::Base.connection.execute(
      "INSERT INTO foundation_trading_names (name, is_default, is_active, created_at, updated_at) " \
      "VALUES ('#{data[:name]}', #{data[:is_default]}, true, NOW(), NOW())"
    )
    puts "  ✓ #{data[:name]}"
  else
    puts "  - #{data[:name]} (exists)"
  end
end

count = ActiveRecord::Base.connection.execute('SELECT COUNT(*) FROM foundation_trading_names').first['count']
puts "Done! #{count} trading names available."
