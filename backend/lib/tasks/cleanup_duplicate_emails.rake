namespace :contacts do
  desc "Clean up duplicate and invalid emails"
  task cleanup_duplicate_emails: :environment do
    puts "=" * 60
    puts "CLEANUP DUPLICATE & INVALID EMAILS"
    puts "=" * 60
    puts

    stats = {
      generic_cleared: 0,
      duplicates_merged: 0,
      contacts_deleted: 0,
      errors: 0
    }

    # 1. Clear generic/invalid emails
    puts "Step 1: Clearing generic/invalid emails..."
    puts

    generic_emails = [
      "info@gmail.com",
      "info@outlook.com",
      "info@hotmail.com",
      "admin@gmail.com",
      "contact@gmail.com"
    ]

    generic_emails.each do |email|
      contacts = Contact.where(email: email)
      if contacts.any?
        contacts.each do |c|
          c.update_column(:email, nil)
          puts "✓ Cleared [#{c.id}] #{c.full_name} - removed generic email: #{email}"
          stats[:generic_cleared] += 1
        end
      end
    end

    puts

    # 2. Handle recent duplicate companies from automated tasks
    puts "Step 2: Merging recent duplicate companies..."
    puts

    duplicate_pairs = [
      # [newer_id, older_id, email]
      [ 2301, 2268, "info@braidenbrothers.com.au" ],  # Joshua Braiden vs Braidenbrothers
      [ 2300, 2267, "info@uniquewindowservices.com" ] # Unique Window Services vs Uniquewindowservices
    ]

    duplicate_pairs.each do |newer_id, older_id, email|
      begin
        newer = Contact.find_by(id: newer_id)
        older = Contact.find_by(id: older_id)

        next unless newer && older

        puts "Merging [#{newer_id}] #{newer.full_name} into [#{older_id}] #{older.full_name}..."

        # Update any people linked to newer company to point to older
        people = Contact.where(primary_company_id: newer_id)
        if people.any?
          people.update_all(primary_company_id: older_id)
          puts "  → Updated #{people.count} people to link to [#{older_id}]"
        end

        # Update any Company records
        company = Company.find_by(contact_id: newer_id)
        if company
          company.update_column(:contact_id, older_id)
          puts "  → Moved Company record to [#{older_id}]"
        end

        # Clear email from newer (will delete it later)
        newer.update_column(:email, nil)

        # Delete the newer duplicate
        newer.destroy
        puts "  ✓ Deleted duplicate [#{newer_id}]"

        stats[:duplicates_merged] += 1
        stats[:contacts_deleted] += 1

      rescue => e
        puts "  ✗ Error merging [#{newer_id}] → [#{older_id}]: #{e.message}"
        stats[:errors] += 1
      end
    end

    puts

    # 3. Handle Tekna duplicates - keep the main one, clear emails from others
    puts "Step 3: Handling Tekna email duplicates..."
    puts

    tekna_email = "robert@tekna.com.au"
    tekna_contacts = Contact.where(email: tekna_email).order(:id)

    if tekna_contacts.count > 1
      # Keep the first one (likely the main Tekna company)
      keeper = tekna_contacts.first
      duplicates = tekna_contacts.where.not(id: keeper.id)

      puts "Keeping [#{keeper.id}] #{keeper.full_name}, clearing email from #{duplicates.count} others..."

      duplicates.each do |dup|
        # Skip if it's a person (might legitimately have this email)
        if dup.entity_type == "person"
          puts "  ⊘ SKIPPED [#{dup.id}] #{dup.full_name} (person)"
          next
        end

        dup.update_column(:email, nil)
        puts "  ✓ Cleared email from [#{dup.id}] #{dup.full_name}"
        stats[:generic_cleared] += 1
      end
    end

    # Handle grace Harder with blank entity_type
    grace = Contact.find_by(id: 1743)
    if grace && grace.full_name == "grace Harder" && grace.entity_type.blank?
      grace.update_columns(entity_type: "person", email: nil)
      puts "  ✓ Fixed [1743] grace Harder - set entity_type to person, cleared duplicate email"
      stats[:generic_cleared] += 1
    end

    puts

    # 4. Show remaining duplicates for manual review
    puts "Step 4: Remaining duplicate emails (for manual review)..."
    puts

    remaining_dupes = Contact.select(:email)
                             .where.not(email: [ nil, "" ])
                             .group(:email)
                             .having("COUNT(*) > 1")
                             .count

    if remaining_dupes.any?
      puts "Found #{remaining_dupes.count} emails still with duplicates:"
      remaining_dupes.first(10).each do |email, count|
        contacts = Contact.where(email: email).pluck(:id, :full_name, :entity_type)
        puts "  #{email} (#{count} contacts):"
        contacts.each do |id, name, type|
          puts "    [#{id}] #{name} (#{type})"
        end
        puts
      end
    else
      puts "✓ No remaining duplicate emails!"
    end

    puts
    puts "=" * 60
    puts "CLEANUP COMPLETE"
    puts "=" * 60
    puts "Generic emails cleared:   #{stats[:generic_cleared]}"
    puts "Duplicates merged:        #{stats[:duplicates_merged]}"
    puts "Contacts deleted:         #{stats[:contacts_deleted]}"
    puts "Errors:                   #{stats[:errors]}"
    puts
  end

  desc "Preview duplicate emails"
  task preview_duplicate_emails: :environment do
    duplicate_emails = Contact.select(:email)
                              .where.not(email: [ nil, "" ])
                              .group(:email)
                              .having("COUNT(*) > 1")
                              .count

    puts "PREVIEW: Duplicate emails (#{duplicate_emails.count} emails):"
    puts

    duplicate_emails.each do |email, count|
      contacts = Contact.where(email: email).order(:id).pluck(:id, :full_name, :entity_type, :created_at)
      puts "#{email} (#{count} contacts):"
      contacts.each do |id, name, type, created|
        puts "  [#{id}] #{name} (#{type}) - created #{created.strftime('%Y-%m-%d')}"
      end
      puts
    end
  end
end
