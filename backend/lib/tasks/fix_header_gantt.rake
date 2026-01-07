namespace :teeem do
  desc "Fix header_gantt values: convert from ID to task_number where mismatched"
  task fix_header_gantt: :environment do
    puts "FIX: Converting header_gantt from ID to task_number"
    puts ""

    # Find headers where id != task_number
    mismatched_headers = SmScheduleMaster.where(allow_header: true).select do |h|
      h.id.to_i != h.task_number.to_i
    end

    if mismatched_headers.empty?
      puts "No mismatched headers found. All header_gantt values are correct."
      exit
    end

    puts "Found #{mismatched_headers.count} headers with ID != task_number:"
    mismatched_headers.each do |h|
      puts "  - #{h.name}: ID=#{h.id}, task_number=#{h.task_number}"
    end
    puts ""

    total_updated = 0

    mismatched_headers.each do |header|
      old_value = header.id  # Children currently point to ID
      new_value = header.task_number  # They should point to task_number

      children = SmScheduleMaster.where(header_gantt: old_value)
      puts "Header: #{header.name}"
      puts "  ID: #{header.id}, task_number: #{header.task_number}"
      puts "  Children with header_gantt=#{old_value}: #{children.count}"

      children.each do |child|
        puts "    Updating #{child.name}: header_gantt #{old_value} → #{new_value}"
        child.update_column(:header_gantt, new_value)
        total_updated += 1
      end
      puts ""
    end

    puts "="*60
    puts "Done! Updated #{total_updated} records."
    puts ""
    puts "Verification:"
    mismatched_headers.each do |header|
      children_by_task_num = SmScheduleMaster.where(header_gantt: header.task_number).count
      puts "  #{header.name}: #{children_by_task_num} children now using task_number=#{header.task_number}"
    end
  end
end
