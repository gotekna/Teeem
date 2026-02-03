# frozen_string_literal: true

# One-time migration to rename Job 46 SharePoint folders to match WarehouseFolder names
#
# Usage:
#   rails job46:migrate_folders           # Dry run (show what would be renamed)
#   rails job46:migrate_folders[execute]  # Actually rename folders
#
namespace :job46 do
  desc "Migrate Job 46 SharePoint folders to match WarehouseFolder names"
  task :migrate_folders, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != 'execute'

    puts "=" * 60
    puts dry_run ? "DRY RUN - No changes will be made" : "EXECUTING - Folders will be renamed!"
    puts "=" * 60
    puts

    job = Job.find(46)
    puts "Job: #{job.name}"
    puts "SharePoint Status: #{job.sharepoint_folder_status}"
    puts

    # Mapping: old SharePoint folder name => new WarehouseFolder name
    # Based on current WarehouseFolder configuration
    FOLDER_MAPPINGS = {
      # Root level folders
      "01 Sales" => "Sales",
      "02 PreCon" => "PreCon",
      "03 Certification" => "Final Certificate",  # Merged into Final Certificate
      "04 Plans" => "Plans",
      "05 Active" => "Site",  # Renamed to Site
      "06 Photo" => "Photo",
      "07 Final Approval" => "Final Certificate",  # Already exists, skip or merge

      # Photo subfolders (under 06 Photo)
      "Photo/01 SITE" => "Photo/Site Photo",
      "Photo/02 SLAB" => "Photo/Slab Photo",
      "Photo/03 FRAME" => "Photo/Frame Photo",
      "Photo/04 ENCLOSED" => "Photo/Enclosed Photo",
      "Photo/05 FIXING" => "Photo/Fixing Photo",
      "Photo/06 Practical Completion" => "Photo/PC Photo",
      "Photo/07 Supervisor Photos" => "Photo/Supervisor Photo",

      # PreCon subfolders
      "PreCon/Colour Selection" => "Contract Info/Colour Selection",
      "PreCon/Contracts" => "Contract Info/Contract",
      "PreCon/Estimation" => nil,  # Remove or archive
      "PreCon/Land Info" => "PreCon/Land Info",  # Same
      "PreCon/Revit-DWG" => "PreCon/Revit-DWG",  # Same

      # Plans subfolders
      "Plans/Certified Plans" => "PreCon/Certified Plans",
      "Plans/Sales Plans" => "Sales/Sales Plans",
      "Plans/Working Drawings" => nil,  # Archive

      # Final Certificate subfolders (from 03 Certification and 07 Final Approval)
      "Final Certificate/Council" => "PreCon/Council",
      "Final Certificate/Energy Efficiency" => "PreCon/Energy Efficiency",
      "Final Certificate/Final Approval" => "Final Certificate/Final Approval",
      "Final Certificate/NDIS" => "PreCon/NDIS",
      "Final Certificate/Plumbing" => "Final Certificate/Plumbing",
      "Final Certificate/Final Docs Required" => "Final Certificate/Final Docs",
      "Final Certificate/Form 21" => "Final Certificate/Form 21",
    }.freeze

    # Get SharePoint client
    cred = OrganizationSharePointCredential.active_credential
    unless cred
      puts "ERROR: No SharePoint credential found"
      exit 1
    end

    client = MicrosoftGraphClient.new(cred)

    # Find job folder
    job_folder = client.find_job_folder(job)
    unless job_folder
      puts "ERROR: Could not find job folder in SharePoint"
      exit 1
    end

    puts "Job folder ID: #{job_folder['id']}"
    puts

    # Get current folder structure
    puts "Current folders:"
    contents = client.list_folder_contents(job_folder['id'])
    folders = contents.select { |item| item[:is_folder] }.sort_by { |f| f[:name] }

    renamed_count = 0
    skipped_count = 0
    errors = []

    folders.each do |folder|
      old_name = folder[:name]
      new_name = FOLDER_MAPPINGS[old_name]

      # Only rename root folders that have a simple mapping (no path separator)
      if new_name && !new_name.include?('/')
        if old_name != new_name
          puts "  #{old_name} => #{new_name}"
          unless dry_run
            begin
              client.rename_file(folder[:id], new_name)
              renamed_count += 1
            rescue => e
              errors << { folder: old_name, error: e.message }
              puts "    ERROR: #{e.message}"
            end
          end
        else
          puts "  #{old_name} (unchanged)"
          skipped_count += 1
        end
      elsif new_name.nil?
        puts "  #{old_name} (no mapping - will skip)"
        skipped_count += 1
      else
        puts "  #{old_name} (complex mapping - handle separately)"
        skipped_count += 1
      end

      # Process subfolders
      begin
        subcontents = client.list_folder_contents(folder[:id])
        subfolders = subcontents.select { |item| item[:is_folder] }.sort_by { |f| f[:name] }

        subfolders.each do |subfolder|
          sub_old_path = "#{old_name}/#{subfolder[:name]}"
          # Use the renamed parent name if available
          parent_for_lookup = new_name && !new_name.include?('/') ? new_name : old_name
          sub_old_lookup = "#{parent_for_lookup}/#{subfolder[:name]}"
          sub_new_path = FOLDER_MAPPINGS[sub_old_lookup] || FOLDER_MAPPINGS[sub_old_path]

          if sub_new_path
            new_subfolder_name = sub_new_path.split('/').last
            if subfolder[:name] != new_subfolder_name
              puts "    #{subfolder[:name]} => #{new_subfolder_name}"
              unless dry_run
                begin
                  client.rename_file(subfolder[:id], new_subfolder_name)
                  renamed_count += 1
                rescue => e
                  errors << { folder: sub_old_path, error: e.message }
                  puts "      ERROR: #{e.message}"
                end
              end
            else
              puts "    #{subfolder[:name]} (unchanged)"
              skipped_count += 1
            end
          else
            puts "    #{subfolder[:name]} (no mapping)"
            skipped_count += 1
          end
        end
      rescue => e
        puts "    (could not list subfolders: #{e.message})"
      end
    end

    puts
    puts "=" * 60
    puts "Summary:"
    puts "  Renamed: #{renamed_count}"
    puts "  Skipped: #{skipped_count}"
    puts "  Errors: #{errors.count}"
    errors.each { |e| puts "    - #{e[:folder]}: #{e[:error]}" }
    puts

    if dry_run
      puts "This was a DRY RUN. To execute, run:"
      puts "  rails job46:migrate_folders[execute]"
    end
  end
end
