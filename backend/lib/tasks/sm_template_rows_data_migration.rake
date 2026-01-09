# frozen_string_literal: true

namespace :sm_template_rows do
  desc "Migrate sm_template_rows to multi-template format and deduplicate"
  task migrate_to_multi_template: :environment do
    puts "Starting sm_template_rows migration to multi-template format..."
    puts "=" * 60

    # Step 1: Find all ts_identifiers that have duplicates
    duplicate_ts_ids = SmScheduleMaster
      .where.not(ts_identifier: nil)
      .group(:ts_identifier)
      .having("COUNT(*) > 1")
      .pluck(:ts_identifier)

    puts "Found #{duplicate_ts_ids.count} ts_identifiers with duplicates"

    # Step 2: Merge duplicates
    merged_count = 0
    deleted_count = 0

    duplicate_ts_ids.each do |ts_id|
      rows = SmScheduleMaster.where(ts_identifier: ts_id).order(:id).to_a
      keeper = rows.first
      duplicates = rows[1..]

      # Merge all template IDs into the keeper
      all_template_ids = rows.flat_map { |r| r.sm_template_ids.presence || [r.sm_template_id] }.compact.uniq.sort
      keeper.update_column(:sm_template_ids, all_template_ids)

      # Delete duplicates
      duplicates.each do |dup|
        dup.destroy
        deleted_count += 1
      end

      merged_count += 1
      print "." if merged_count % 10 == 0
    end

    puts "\nMerged #{merged_count} groups, deleted #{deleted_count} duplicate rows"
    puts "=" * 60

    # Step 3: For rows without ts_identifier, ensure sm_template_ids is set
    rows_without_ts = SmScheduleMaster.where(ts_identifier: nil)
    rows_without_ts.find_each do |row|
      if row.sm_template_ids.blank? && row.sm_template_id.present?
        row.update_column(:sm_template_ids, [row.sm_template_id])
      end
    end
    puts "Updated #{rows_without_ts.count} rows without ts_identifier"

    # Step 4: Set ID = ts_identifier for all rows that have ts_identifier
    puts "=" * 60
    puts "Setting ID = ts_identifier for master list rows..."

    # Temporarily disable foreign key checks
    ActiveRecord::Base.connection.execute("SET session_replication_role = 'replica';")

    begin
      updated_count = 0
      SmScheduleMaster.where.not(ts_identifier: nil).find_each do |row|
        next if row.id == row.ts_identifier

        row.update_column(:id, row.ts_identifier)
        updated_count += 1
        print "." if updated_count % 10 == 0
      end

      puts "\nUpdated #{updated_count} row IDs to match ts_identifier"
    ensure
      # Re-enable foreign key checks
      ActiveRecord::Base.connection.execute("SET session_replication_role = 'origin';")
    end

    # Step 5: Reset the sequence
    max_id = SmScheduleMaster.maximum(:id) || 0
    ActiveRecord::Base.connection.execute(
      "SELECT setval('sm_template_rows_id_seq', #{max_id})"
    )
    puts "Reset sequence to #{max_id}"

    # Final stats
    puts "=" * 60
    puts "Migration complete!"
    puts "Total rows: #{SmScheduleMaster.count}"
    puts "Rows with ts_identifier: #{SmScheduleMaster.where.not(ts_identifier: nil).count}"
    puts "Rows without ts_identifier: #{SmScheduleMaster.where(ts_identifier: nil).count}"
    puts "ID range: #{SmScheduleMaster.minimum(:id)} - #{SmScheduleMaster.maximum(:id)}"
  end

  desc "Verify multi-template migration was successful"
  task verify_migration: :environment do
    puts "Verifying sm_template_rows migration..."
    puts "=" * 60

    errors = []

    # Check 1: No duplicate ts_identifiers
    dup_count = SmScheduleMaster
      .where.not(ts_identifier: nil)
      .group(:ts_identifier)
      .having("COUNT(*) > 1")
      .count
      .keys.count

    if dup_count > 0
      errors << "Found #{dup_count} duplicate ts_identifiers!"
    else
      puts "✅ No duplicate ts_identifiers"
    end

    # Check 2: ID = ts_identifier for all rows with ts_identifier
    mismatch = SmScheduleMaster
      .where.not(ts_identifier: nil)
      .where("id != ts_identifier")
      .count

    if mismatch > 0
      errors << "Found #{mismatch} rows where ID != ts_identifier!"
    else
      puts "✅ All IDs match ts_identifier"
    end

    # Check 3: All rows have sm_template_ids populated
    empty_template_ids = SmScheduleMaster.where("sm_template_ids = '[]'::jsonb OR sm_template_ids IS NULL").count
    if empty_template_ids > 0
      errors << "Found #{empty_template_ids} rows with empty sm_template_ids!"
    else
      puts "✅ All rows have sm_template_ids populated"
    end

    # Check 4: Template row counts
    puts "\nTemplate row counts:"
    [6, 7, 9].each do |template_id|
      count = SmScheduleMaster.where("sm_template_ids @> ?", [template_id].to_json).count
      puts "  Template #{template_id}: #{count} rows"
    end

    if errors.any?
      puts "\n❌ ERRORS:"
      errors.each { |e| puts "  - #{e}" }
      exit 1
    else
      puts "\n✅ All checks passed!"
    end
  end
end
