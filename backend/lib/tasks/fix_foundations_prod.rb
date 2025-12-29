# Fix Foundation database_table_name mismatches
fixes = {
  'sm-schedule-master' => 'sm_schedule_masters',
  'pricebook-items' => 'pricebooks',
  'trinities' => 'trinities',
  'job_status' => 'job_statuses'
}

fixes.each do |slug, correct_table|
  f = Foundation.find_by(slug: slug)
  if f
    old_table = f.database_table_name
    f.update!(database_table_name: correct_table)
    puts "Fixed #{slug}: #{old_table} -> #{correct_table}"
  else
    puts "Foundation not found: #{slug}"
  end
end
