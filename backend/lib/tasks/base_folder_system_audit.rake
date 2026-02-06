# frozen_string_literal: true

namespace :base_folders do
  desc "Audit and fix is_system flag on warehouse folders (only code-required folders should be system)"
  task audit_system: :environment do
    # SSoT: Only ROOT/PRIMARY warehouse folders that code depends on are system folders
    # Code references these in: warehouse_document.rb, warehouse_provider.rb, sm_task_attachment.rb
    ROOT_FOLDERS = {
      "job" => ["Jobs"],
      "contact" => ["Contacts"],
      "corporate" => ["Corporate"],
      "email" => ["Mailbox"],  # Mailbox handles all email storage now
      "task" => ["Task Attachments", "Task Responses"],
      "case" => ["Cases"],
      "document" => ["Documents"],
      "template" => ["Templates", "Template Documents", "Template Bank Statements",
                     "Template Invoices", "Template Email Signatures", "Template PDF Fields"],
      "user" => ["Teeem Docs"],
      "warehouse" => ["Warehousing", "TeeemXL", "TeeemWord", "TeeemPowerPoint", "TeeemNotes", "TeeemPDF"]
    }.freeze

    puts "Base Folder System Audit"
    puts "=" * 60

    issues = []
    WarehouseFolder.includes(:warehouse_type).find_each do |bf|
      type_code = bf.warehouse_type&.code
      required_names = ROOT_FOLDERS[type_code] || []
      should_be_system = required_names.include?(bf.name)

      if bf.is_system != should_be_system
        issues << { folder: bf, should_be: should_be_system }
      end
    end

    if issues.empty?
      puts "✓ All warehouse folders have correct is_system flag"
    else
      puts "Found #{issues.count} folders with incorrect is_system flag:\n"
      issues.each do |issue|
        bf = issue[:folder]
        current = bf.is_system ? "TRUE" : "FALSE"
        correct = issue[:should_be] ? "TRUE" : "FALSE"
        puts "  #{bf.warehouse_type&.code}/#{bf.name}: is_system=#{current} should be #{correct}"
      end

      print "\nFix these issues? [y/N] "
      if ENV["FIX"] == "true" || STDIN.gets&.strip&.downcase == "y"
        issues.each do |issue|
          issue[:folder].update_column(:is_system, issue[:should_be])
        end
        puts "\n✓ Fixed #{issues.count} folders"
      else
        puts "\nRun with FIX=true to auto-fix: rails base_folders:audit_system FIX=true"
      end
    end

    puts "\nSummary:"
    puts "  System folders: #{WarehouseFolder.where(is_system: true).count}"
    puts "  Non-system folders: #{WarehouseFolder.where(is_system: false).count}"
  end
end
