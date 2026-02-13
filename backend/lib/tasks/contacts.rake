namespace :contacts do
  # Shared scoring helper for duplicate merge tasks
  def score_contact_for_merge(contact)
    score = 0
    score += 100 if contact.xero_id.present?
    score += 10 if contact.email.present?
    score += 5 if contact.mobile_phone.present?
    score += 3 if contact.last_name.present?
    score += 3 if contact.first_name.present?
    score += contact.roles.to_a.size * 2
    # Longer display_name = more complete record
    score += [contact.display_name.to_s.length, 20].min
    score
  end

  desc "Fix company contacts - set entity_type and company_name_or_trust, clear first_name/last_name"
  task fix_companies: :environment do
    # Use same patterns as XeroContactSyncService
    company_patterns = XeroContactSyncService::COMPANY_INDICATORS

    def is_company?(name, patterns)
      return false if name.blank?
      patterns.any? { |pattern| name.match?(pattern) }
    end

    fixed = 0
    errors = []

    Contact.find_each do |c|
      next unless is_company?(c.full_name, company_patterns)
      next if c.entity_type == "company" # Already correct

      begin
        updates = { entity_type: "company" }

        # Set company_name_or_trust if blank
        updates[:company_name_or_trust] = c.full_name if c.company_name_or_trust.blank?

        # If first_name has company name (indicating it was incorrectly set), clear it
        if c.first_name.present? && is_company?(c.first_name, company_patterns)
          updates[:first_name] = nil
          updates[:last_name] = nil
        end

        c.update_columns(updates)
        fixed += 1
        puts "Fixed: #{c.id} - #{c.full_name}" if fixed <= 20
      rescue => e
        errors << "#{c.id}: #{e.message}"
      end
    end

    puts "..." if fixed > 20
    puts "=" * 50
    puts "Total fixed: #{fixed}"
    puts "Errors: #{errors.count}"
    errors.first(5).each { |e| puts "  - #{e}" } if errors.any?
  end

  desc "Show contacts with company indicators that are not entity_type=company"
  task check_companies: :environment do
    company_patterns = XeroContactSyncService::COMPANY_INDICATORS

    mismatched = Contact.where.not(entity_type: "company").select do |c|
      company_patterns.any? { |p| c.full_name.to_s.match?(p) }
    end

    puts "Contacts with company indicators but not entity_type='company': #{mismatched.count}"
    mismatched.first(20).each do |c|
      puts "  #{c.id}: #{c.full_name} - entity: #{c.entity_type}, first: #{c.first_name.inspect}"
    end
    puts "  ..." if mismatched.count > 20

    puts "\nEntity type distribution:"
    puts "  Company: #{Contact.where(entity_type: 'company').count}"
    puts "  Person:  #{Contact.where(entity_type: 'person').count}"
    puts "  Nil:     #{Contact.where(entity_type: nil).count}"
  end

  desc "Preview duplicate contacts that would be auto-merged (dry run)"
  task auto_merge_preview: :environment do
    puts "=" * 60
    puts "CONTACT AUTO-MERGE PREVIEW (DRY RUN)"
    puts "=" * 60
    puts

    service = ContactAutoMergeService.new(dry_run: true)
    result = service.run

    puts "\nSUMMARY"
    puts "-" * 40
    puts "  Duplicate groups found: #{result[:groups_found]}"
    puts "  Contacts that would be merged: #{result[:contacts_merged]}"
    puts "  Xero connections preserved: #{result[:xero_connections_preserved]}"
    puts

    if result[:merged_groups].any?
      puts "MERGE PLAN"
      puts "-" * 40
      result[:merged_groups].each_with_index do |group, i|
        xero_badge = group[:target_xero] ? " [XERO]" : ""
        puts "  #{i + 1}. Keep: #{group[:target_name]} (ID: #{group[:target_id]})#{xero_badge}"
        puts "     Merge: #{group[:source_names].join(', ')}"
        puts "     IDs: #{group[:source_ids].join(', ')}"
        puts
      end
    end

    if result[:errors].any?
      puts "ERRORS"
      puts "-" * 40
      result[:errors].each { |e| puts "  - #{e}" }
    end

    puts "\nTo actually merge, run: rails contacts:auto_merge"
  end

  desc "Find partial-match duplicates within the same company (e.g., 'Rachel' vs 'Rachel Anne Harder')"
  task find_partial_duplicates: :environment do
    puts "=" * 70
    puts "PARTIAL-MATCH DUPLICATE FINDER"
    puts "Finds contacts in the same company with overlapping names"
    puts "=" * 70
    puts

    # Phase 1: Exact-match duplicates (existing tool)
    puts "PHASE 1: EXACT NAME MATCHES"
    puts "-" * 50
    exact_service = ContactAutoMergeService.new(dry_run: true)
    exact_result = exact_service.run
    puts "  Found #{exact_result[:groups_found]} exact duplicate groups"
    puts "  #{exact_result[:contacts_merged]} contacts would be merged"
    exact_result[:merged_groups].each_with_index do |group, i|
      xero_badge = group[:target_xero] ? " [XERO]" : ""
      puts "  #{i + 1}. Keep: #{group[:target_name]} (ID: #{group[:target_id]})#{xero_badge}"
      puts "     Merge: #{group[:source_names].join(', ')} (IDs: #{group[:source_ids].join(', ')})"
    end
    puts

    # Phase 2: Same-company partial name matches
    puts "PHASE 2: SAME-COMPANY PARTIAL NAME MATCHES"
    puts "-" * 50

    # Get all non-deleted contacts grouped by primary_company_id
    contacts = Contact.where(deleted: [false, nil])
                     .where.not(primary_company_id: nil)
                     .includes(:contact_emails, :contact_phones, :contact_addresses)
                     .select(:id, :display_name, :first_name, :last_name, :email,
                             :mobile_phone, :entity_type, :primary_company_id,
                             :xero_id, :roles, :created_at)

    by_company = contacts.group_by(&:primary_company_id)

    partial_groups = []

    by_company.each do |company_id, company_contacts|
      next if company_contacts.size < 2

      # Compare each pair within the company
      company_contacts.combination(2).each do |a, b|
        next if a.display_name.blank? || b.display_name.blank?

        name_a = a.display_name.downcase.strip
        name_b = b.display_name.downcase.strip

        # Skip if exact match (Phase 1 handles these)
        next if name_a == name_b

        match_reason = nil

        # Check 1: One name starts with the other (e.g., "Rachel" / "Rachel Anne Harder")
        if name_b.start_with?(name_a + " ") || name_a.start_with?(name_b + " ")
          match_reason = "name_prefix"
        end

        # Check 2: Same last_name and one first_name starts with the other
        if match_reason.nil? && a.last_name.present? && b.last_name.present?
          if a.last_name.downcase.strip == b.last_name.downcase.strip
            fa = a.first_name.to_s.downcase.strip
            fb = b.first_name.to_s.downcase.strip
            if fa.present? && fb.present? && (fa.start_with?(fb) || fb.start_with?(fa))
              match_reason = "same_last_name_similar_first"
            end
          end
        end

        # Check 3: One contact has only a first name that matches the other's first name
        if match_reason.nil? && a.first_name.present? && b.first_name.present?
          fa = a.first_name.downcase.strip
          fb = b.first_name.downcase.strip
          if fa == fb
            a_has_last = a.last_name.present?
            b_has_last = b.last_name.present?
            if a_has_last != b_has_last
              match_reason = "same_first_name_missing_last"
            end
          end
        end

        # Check 4: Same email address
        if match_reason.nil?
          email_a = a.email.to_s.downcase.strip
          email_b = b.email.to_s.downcase.strip
          if email_a.present? && email_b.present? && email_a == email_b
            match_reason = "same_email"
          end
        end

        next unless match_reason

        # Score: which one to keep (higher = better)
        score_a = score_contact_for_merge(a)
        score_b = score_contact_for_merge(b)

        if score_a >= score_b
          target, source = a, b
          target_score, source_score = score_a, score_b
        else
          target, source = b, a
          target_score, source_score = score_b, score_a
        end

        company = Contact.find_by(id: company_id)
        company_name = company&.display_name || "Company ##{company_id}"

        partial_groups << {
          company_id: company_id,
          company_name: company_name,
          match_reason: match_reason,
          target_id: target.id,
          target_name: target.display_name,
          target_score: target_score,
          target_xero: target.xero_id.present?,
          source_id: source.id,
          source_name: source.display_name,
          source_score: source_score,
          source_xero: source.xero_id.present?
        }
      end
    end

    # Also check contacts WITHOUT a company but with same email
    puts "\nPHASE 3: SAME-EMAIL DUPLICATES (NO COMPANY)"
    puts "-" * 50

    email_contacts = Contact.where(deleted: [false, nil])
                           .where.not(email: [nil, ""])
                           .select(:id, :display_name, :first_name, :last_name, :email,
                                   :mobile_phone, :entity_type, :primary_company_id,
                                   :xero_id, :roles, :created_at)

    by_email = email_contacts.group_by { |c| c.email.to_s.downcase.strip }
    email_dupes = 0
    by_email.each do |email, group|
      next if email.blank? || group.size < 2
      email_dupes += 1
      puts "  Email: #{email}" if email_dupes <= 20
      group.each do |c|
        xero = c.xero_id.present? ? " [XERO]" : ""
        puts "    - #{c.display_name} (ID: #{c.id})#{xero}"
      end
    end
    puts "  ... and #{email_dupes - 20} more groups" if email_dupes > 20
    puts "  Total email duplicate groups: #{email_dupes}"
    puts

    # Output partial matches
    if partial_groups.any?
      puts "\nPARTIAL NAME MATCHES WITHIN SAME COMPANY"
      puts "-" * 50
      puts "  Found #{partial_groups.size} potential duplicate pairs"
      puts

      # Group by match reason for readability
      by_reason = partial_groups.group_by { |g| g[:match_reason] }

      by_reason.each do |reason, groups|
        reason_label = case reason
                       when "name_prefix" then "Name is prefix of another"
                       when "same_last_name_similar_first" then "Same last name, similar first name"
                       when "same_first_name_missing_last" then "Same first name, one missing last name"
                       when "same_email" then "Same email address"
                       else reason
                       end

        puts "  #{reason_label} (#{groups.size}):"
        groups.each_with_index do |g, i|
          target_xero = g[:target_xero] ? " [XERO]" : ""
          source_xero = g[:source_xero] ? " [XERO]" : ""
          puts "    #{i + 1}. Company: #{g[:company_name]}"
          puts "       KEEP:  #{g[:target_name]} (ID: #{g[:target_id]}, score: #{g[:target_score]})#{target_xero}"
          puts "       MERGE: #{g[:source_name]} (ID: #{g[:source_id]}, score: #{g[:source_score]})#{source_xero}"
        end
        puts
      end

      puts "\nMERGE COMMANDS"
      puts "-" * 50
      puts "To merge these pairs, run in Rails console:"
      puts
      partial_groups.each do |g|
        puts "  # #{g[:source_name]} -> #{g[:target_name]} (#{g[:match_reason]})"
        puts "  GenericMergeService.new(Contact.find(#{g[:target_id]}), Contact.find(#{g[:source_id]})).merge!"
        puts
      end

      puts "Or to merge ALL #{partial_groups.size} pairs at once:"
      puts "  rails contacts:merge_partial_duplicates"
    else
      puts "\n  No partial-match duplicates found!"
    end
  end

  desc "Merge partial-match duplicates found by find_partial_duplicates (DESTRUCTIVE)"
  task merge_partial_duplicates: :environment do
    puts "=" * 70
    puts "PARTIAL-MATCH DUPLICATE MERGER (LIVE MODE)"
    puts "=" * 70
    puts
    puts "WARNING: This will merge partial-match duplicates!"
    puts "Run 'rails contacts:find_partial_duplicates' first to preview."
    puts

    print "Type 'yes' to continue: "
    confirmation = STDIN.gets&.chomp
    unless confirmation == "yes"
      puts "Aborted."
      exit 1
    end

    contacts = Contact.where(deleted: [false, nil])
                     .where.not(primary_company_id: nil)
                     .select(:id, :display_name, :first_name, :last_name, :email,
                             :mobile_phone, :entity_type, :primary_company_id,
                             :xero_id, :roles, :created_at)

    by_company = contacts.group_by(&:primary_company_id)
    merged = 0
    errors = []

    by_company.each do |company_id, company_contacts|
      next if company_contacts.size < 2

      # Track already-merged IDs to avoid re-processing
      merged_ids = Set.new

      company_contacts.combination(2).each do |a, b|
        next if merged_ids.include?(a.id) || merged_ids.include?(b.id)
        next if a.display_name.blank? || b.display_name.blank?

        name_a = a.display_name.downcase.strip
        name_b = b.display_name.downcase.strip
        next if name_a == name_b

        is_match = false

        # Same checks as find_partial_duplicates
        if name_b.start_with?(name_a + " ") || name_a.start_with?(name_b + " ")
          is_match = true
        end

        if !is_match && a.last_name.present? && b.last_name.present?
          if a.last_name.downcase.strip == b.last_name.downcase.strip
            fa = a.first_name.to_s.downcase.strip
            fb = b.first_name.to_s.downcase.strip
            if fa.present? && fb.present? && (fa.start_with?(fb) || fb.start_with?(fa))
              is_match = true
            end
          end
        end

        if !is_match && a.first_name.present? && b.first_name.present?
          fa = a.first_name.downcase.strip
          fb = b.first_name.downcase.strip
          if fa == fb && (a.last_name.present? != b.last_name.present?)
            is_match = true
          end
        end

        next unless is_match

        score_a = score_contact_for_merge(a)
        score_b = score_contact_for_merge(b)
        target, source = score_a >= score_b ? [a, b] : [b, a]

        begin
          # Reload to get full objects for merge
          target_full = Contact.find(target.id)
          source_full = Contact.find(source.id)
          GenericMergeService.new(target_full, source_full).merge!
          merged += 1
          merged_ids << source.id
          puts "  Merged: #{source.display_name} (#{source.id}) -> #{target.display_name} (#{target.id})"
        rescue => e
          errors << "#{source.id} -> #{target.id}: #{e.message}"
        end
      end
    end

    puts
    puts "RESULTS"
    puts "-" * 40
    puts "  Pairs merged: #{merged}"
    puts "  Errors: #{errors.size}"
    errors.each { |e| puts "    - #{e}" } if errors.any?
  end

  desc "Auto-merge duplicate contacts with matching names (DESTRUCTIVE)"
  task auto_merge: :environment do
    puts "=" * 60
    puts "CONTACT AUTO-MERGE (LIVE MODE)"
    puts "=" * 60
    puts
    puts "WARNING: This will permanently merge duplicate contacts!"
    puts "Xero connections will be preserved by keeping the linked contact."
    puts

    # Get confirmation
    print "Type 'yes' to continue: "
    confirmation = STDIN.gets&.chomp

    unless confirmation == "yes"
      puts "Aborted."
      exit 1
    end

    puts "\nRunning auto-merge..."
    service = ContactAutoMergeService.new(dry_run: false)
    result = service.run

    puts "\nRESULTS"
    puts "-" * 40
    puts "  Duplicate groups processed: #{result[:groups_found]}"
    puts "  Contacts merged: #{result[:contacts_merged]}"
    puts "  Contacts deleted: #{result[:contacts_deleted]}"
    puts "  Xero connections preserved: #{result[:xero_connections_preserved]}"

    if result[:merged_groups].any?
      puts "\nMERGED GROUPS"
      puts "-" * 40
      result[:merged_groups].each_with_index do |group, i|
        xero_badge = group[:target_xero] ? " [XERO]" : ""
        puts "  #{i + 1}. Kept: #{group[:target_name]} (ID: #{group[:target_id]})#{xero_badge}"
        puts "     Merged: #{group[:source_names].join(', ')}"
      end
    end

    if result[:errors].any?
      puts "\nERRORS"
      puts "-" * 40
      result[:errors].each { |e| puts "  - #{e}" }
    end

    puts "\nDone!"
  end
end
