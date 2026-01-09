# frozen_string_literal: true

namespace :foundation do
  desc "Backfill lookup_foundation_slug for all columns with lookup_foundation_id"
  task backfill_lookup_slugs: :environment do
    puts "=" * 60
    puts "Backfilling lookup_foundation_slug for columns..."
    puts "=" * 60

    # Find all columns with lookup_foundation_id set
    columns_with_lookups = Column.where.not(lookup_foundation_id: nil)
    total = columns_with_lookups.count
    updated = 0
    missing = 0
    already_set = 0

    puts "Found #{total} columns with lookup_foundation_id"
    puts ""

    columns_with_lookups.find_each do |column|
      # Skip if slug is already set
      if column.lookup_foundation_slug.present?
        already_set += 1
        next
      end

      # Find the lookup foundation
      lookup_foundation = Foundation.find_by(id: column.lookup_foundation_id)

      if lookup_foundation.nil?
        missing += 1
        puts "  ⚠️  MISSING: Column '#{column.name}' (ID: #{column.id}) references foundation_id #{column.lookup_foundation_id} which doesn't exist"
        puts "     Foundation: #{column.foundation.name} (#{column.foundation.slug})"
        next
      end

      # Update the slug
      column.update_column(:lookup_foundation_slug, lookup_foundation.slug)
      updated += 1
      puts "  ✅ #{column.foundation.name}.#{column.name} → #{lookup_foundation.slug}"
    end

    puts ""
    puts "=" * 60
    puts "Backfill complete!"
    puts "  Updated: #{updated}"
    puts "  Already set: #{already_set}"
    puts "  Missing foundations: #{missing}"
    puts "=" * 60

    if missing > 0
      puts ""
      puts "⚠️  WARNING: #{missing} columns reference missing foundations!"
      puts "   Run 'rails foundation:fix_broken_lookups' to clean these up"
    end
  end

  desc "List columns with broken lookup references (missing foundations)"
  task list_broken_lookups: :environment do
    puts "=" * 60
    puts "Columns with broken lookup references:"
    puts "=" * 60

    broken = []

    Column.where.not(lookup_foundation_id: nil).find_each do |column|
      lookup_foundation = Foundation.find_by(id: column.lookup_foundation_id)

      if lookup_foundation.nil?
        broken << {
          column_id: column.id,
          column_name: column.name,
          foundation_name: column.foundation.name,
          foundation_slug: column.foundation.slug,
          lookup_foundation_id: column.lookup_foundation_id
        }
      end
    end

    if broken.empty?
      puts "✅ No broken lookup references found!"
    else
      puts "Found #{broken.length} broken references:"
      puts ""

      broken.each do |b|
        puts "  Column ID: #{b[:column_id]}"
        puts "  Column Name: #{b[:column_name]}"
        puts "  Foundation: #{b[:foundation_name]} (#{b[:foundation_slug]})"
        puts "  Missing lookup_foundation_id: #{b[:lookup_foundation_id]}"
        puts ""
      end
    end
  end

  desc "Fix broken lookup references by clearing them"
  task fix_broken_lookups: :environment do
    puts "=" * 60
    puts "Fixing broken lookup references..."
    puts "=" * 60

    fixed = 0

    Column.where.not(lookup_foundation_id: nil).find_each do |column|
      lookup_foundation = Foundation.find_by(id: column.lookup_foundation_id)

      if lookup_foundation.nil?
        puts "  Clearing broken lookup for: #{column.foundation.name}.#{column.name}"
        puts "    Was: lookup_foundation_id = #{column.lookup_foundation_id}"

        # Clear the broken reference
        column.update_columns(
          lookup_foundation_id: nil,
          lookup_foundation_slug: nil,
          lookup_display_column: nil,
          column_type: "single_line_text"  # Downgrade to text field
        )
        fixed += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Fixed #{fixed} broken lookup references"
    puts "=" * 60
  end

  desc "Show lookup column statistics"
  task lookup_stats: :environment do
    puts "=" * 60
    puts "Lookup Column Statistics"
    puts "=" * 60

    total_columns = Column.count
    lookup_columns = Column.where(column_type: %w[lookup multiple_lookups]).count
    with_slug = Column.where.not(lookup_foundation_slug: nil).count
    with_id_only = Column.where.not(lookup_foundation_id: nil).where(lookup_foundation_slug: nil).count

    puts "Total columns: #{total_columns}"
    puts "Lookup columns: #{lookup_columns}"
    puts "  With slug: #{with_slug}"
    puts "  ID only (need backfill): #{with_id_only}"
    puts ""

    # Group by foundation
    puts "By Foundation:"
    Column.where(column_type: %w[lookup multiple_lookups])
          .includes(:foundation, :lookup_foundation)
          .group_by(&:foundation_id)
          .each do |_fid, cols|
      foundation = cols.first.foundation
      puts "  #{foundation.name}: #{cols.count} lookup columns"
    end
  end
end
