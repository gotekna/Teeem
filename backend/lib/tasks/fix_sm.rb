f = Foundation.find_by(slug: 'sm_schedule_master')
if f
  puts "Before: slug=#{f.slug}, table=#{f.database_table_name}"
  f.update!(slug: 'sm-schedule-master', database_table_name: 'sm_schedule_masters')
  puts "After: slug=#{f.slug}, table=#{f.database_table_name}"
else
  puts 'Foundation not found'
end
