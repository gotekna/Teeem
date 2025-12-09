namespace :contacts do
  desc "Fix people who are linked to themselves as their primary company"
  task fix_self_linked_people: :environment do
    puts "=" * 60
    puts "FIXING SELF-LINKED PEOPLE"
    puts "=" * 60
    puts

    # Find people where primary_company_id points to themselves
    self_linked = Contact.where(entity_type: "person")
                        .where("id = primary_company_id")

    puts "Found #{self_linked.count} people linked to themselves"
    puts

    if self_linked.count == 0
      puts "No self-linked people found!"
      return
    end

    stats = {
      fixed: 0,
      errors: []
    }

    puts "=" * 60
    puts "FIXING"
    puts "=" * 60
    puts

    self_linked.each do |person|
      begin
        old_company_id = person.primary_company_id

        # Clear the self-referencing primary_company_id
        person.update_column(:primary_company_id, nil)

        puts "✓ [#{person.id}] #{person.full_name}"
        puts "  Cleared self-link (was pointing to own ID: #{old_company_id})"
        puts
        stats[:fixed] += 1
      rescue => e
        error_msg = "Failed to fix [#{person.id}] #{person.full_name}: #{e.message}"
        puts "✗ #{error_msg}"
        stats[:errors] << error_msg
      end
    end

    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Fixed: #{stats[:fixed]}"
    puts "Errors: #{stats[:errors].count}"
    puts

    if stats[:errors].any?
      puts "Error details:"
      stats[:errors].each { |err| puts "  - #{err}" }
    end
  end
end
