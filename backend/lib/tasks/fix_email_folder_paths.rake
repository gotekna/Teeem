# frozen_string_literal: true

# Fix "Email/" (singular) folder_paths to "Emails/" (plural)
#
# FRC (Feb 2026): WarehousePathComputer.build_path_template fallback used
# wt.code.titleize which produces "Email" (singular) instead of "Emails" (plural).
# This happened when folder_path_template was blank on the email warehouse_type.
#
# Usage:
#   rails warehouse:fix_email_paths          # Dry run
#   rails warehouse:fix_email_paths[execute]  # Apply fix

namespace :warehouse do
  desc "Fix Email/ (singular) folder_paths to Emails/ (plural)"
  task :fix_email_paths, [:mode] => :environment do |_t, args|
    execute = args[:mode] == "execute"

    puts "=" * 70
    puts execute ? "EXECUTING Email -> Emails folder_path fix" : "DRY RUN - pass [execute] to apply"
    puts "=" * 70

    # Find documents with "Email/" but NOT "Emails/"
    affected = WarehouseDocument.where("folder_path LIKE 'Email/%' AND folder_path NOT LIKE 'Emails/%'")
    count = affected.count

    puts "Found #{count} documents with 'Email/' (singular) folder_path"

    if count.zero?
      puts "Nothing to fix!"
      next
    end

    # Show some examples
    affected.limit(10).each do |doc|
      new_path = "Emails" + doc.folder_path[5..]
      puts "  #{doc.id}: #{doc.folder_path} -> #{new_path}"
    end
    puts "  ... and #{count - 10} more" if count > 10

    if execute
      # SQL replace: "Email/" at start -> "Emails/"
      updated = affected.update_all("folder_path = 'Emails' || substr(folder_path, 6)")
      puts "\nUpdated #{updated} documents"
    else
      puts "\nRun with [execute] to apply changes"
    end

    puts "=" * 70
  end
end
