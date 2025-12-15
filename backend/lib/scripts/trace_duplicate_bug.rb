# Trace Duplicate Bug
# This script simulates the exact query flow to find where duplicates appear

puts "=" * 80
puts "DUPLICATE BUG INVESTIGATION"
puts "=" * 80

# Step 1: Build the query exactly like RecordsController does
model = Contact
query = model.all

# Step 2: Apply eager loading
associations = []
model.reflect_on_all_associations(:belongs_to).each do |reflection|
  associations << reflection.name
end
puts "\nAssociations to eager load: #{associations.inspect}"

query = query.includes(*associations) if associations.any?

# Step 3: Add distinct
query = query.distinct

# Step 4: Apply filters
query = query.where(is_active: [true, nil])

# Step 5: Sort
query = query.order(created_at: :desc)

# Step 6: Limit
query = query.limit(20)

puts "\nSQL Generated:"
puts query.to_sql
puts "\n" + "=" * 80

# Step 7: Execute and check
puts "\nExecuting query..."
records = query.to_a

puts "Records returned: #{records.count}"
puts "Unique IDs: #{records.map(&:id).uniq.count}"

# Check for duplicates
id_counts = records.map(&:id).tally
duplicates = id_counts.select { |id, count| count > 1 }

if duplicates.any?
  puts "\n❌ DUPLICATES FOUND IN ACTIVERECORD RESULT:"
  duplicates.each do |id, count|
    puts "  ID #{id}: appears #{count} times"
    dup_records = records.select { |r| r.id == id }
    puts "    Object IDs: #{dup_records.map(&:object_id).inspect}"
    puts "    Are they same object? #{dup_records.map(&:object_id).uniq.count == 1}"
  end
else
  puts "\n✅ No duplicates in ActiveRecord result"
end

# Now test if it's in the serialization
puts "\n" + "=" * 80
puts "Testing serialization (record_to_json equivalent)..."

serialized = records.map do |r|
  {
    id: r.id,
    display_name: r.display_name,
    created_at: r.created_at
  }
end

puts "Serialized records: #{serialized.count}"
puts "Unique IDs after serialization: #{serialized.map { |r| r[:id] }.uniq.count}"

ser_id_counts = serialized.map { |r| r[:id] }.tally
ser_duplicates = ser_id_counts.select { |id, count| count > 1 }

if ser_duplicates.any?
  puts "\n❌ DUPLICATES FOUND AFTER SERIALIZATION:"
  ser_duplicates.each { |id, count| puts "  ID #{id}: appears #{count} times" }
else
  puts "\n✅ No duplicates after serialization"
end

puts "\n" + "=" * 80
puts "CONCLUSION:"
if duplicates.any?
  puts "Duplicates appear in ActiveRecord query result"
  puts "This suggests a database-level issue or Rails query bug"
elsif ser_duplicates.any?
  puts "Duplicates appear during serialization"
  puts "This suggests a bug in record_to_json method"
else
  puts "NO DUPLICATES FOUND - Issue might be in frontend or caching"
end
puts "=" * 80
