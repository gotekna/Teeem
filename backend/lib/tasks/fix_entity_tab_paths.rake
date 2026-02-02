namespace :warehouse_folders do
  desc "Fix warehouse_folder paths to use proper tokens instead of hardcoded values"
  task fix_paths: :environment do
    puts "=== Fixing Entity Tab Warehouse Folder Paths ==="
    puts ""

    updated = 0
    errors = []

    # 1. Contact-specific tabs
    contact_tabs_paths = {
      369 => "My Documents",  # My Documents - relative to Contacts/{{ContactName}}/
    }

    # User tabs are OBSOLETE - now use Contacts instead
    # Tabs 366, 367, 368 should already be disabled

    # 2. Email tabs - relative paths under Email scope
    email_tabs = {
      385 => "Body",        # Email Body - child of Emails scope
      383 => "Attachments", # Email Attachments - child of Emails scope
    }

    # 3. Task tabs - relative paths under Task scope
    task_tabs = {
      386 => "Attachments",  # Task Attachments
      388 => "Attachments",  # Task Attachments
      389 => "Responses",    # Task Responses
    }

    # 4. Document tabs - use context tokens
    document_tabs = {
      153 => "{{TabName}}/Documents",   # Documents under a tab
      58 => "{{TabName}}/Documents",    # Documents
      95 => "{{TabName}}/Documents",    # Documents main
      382 => "{{TabName}}/Custom",      # Custom Documents
    }

    # 5. Shared/Global tabs - organized structure
    shared_tabs = {
      365 => "Warehouse",               # Root
      370 => "Shared/Bill Inbox",       # Bill Inbox
      371 => "Shared/Chat",             # Chat
      372 => "Shared/Notes",            # Notes
      373 => "Shared/Templates",        # Templates root
      374 => "Shared/Templates/Bank Statements",  # Bank Statements
      375 => "Shared/Templates/Contracts",        # Contracts
      376 => "Shared/Pricebook Photos", # Pricebook Photos
      377 => "Shared/Excel",            # Excel Documents
      378 => "Shared/Word",             # Word Documents
      379 => "Shared/PowerPoint",       # PowerPoint Documents
      380 => "Shared/PDF",              # PDF Documents
      381 => "System/ActiveStorage",    # Active Storage
      167 => "Shared/Revit",            # Revit files
    }

    # 6. Fix malformed Bills path
    bills_fix = {
      299 => "{{XeroConnectionName}}/{{ContactName}}/Bills"
    }

    all_updates = contact_tabs_paths
      .merge(email_tabs)
      .merge(task_tabs)
      .merge(document_tabs)
      .merge(shared_tabs)
      .merge(bills_fix)

    puts "Updating warehouse_folder paths..."
    all_updates.each do |tab_id, new_path|
      tab = WarehouseFolder.find_by(id: tab_id)
      if tab
        old_path = tab.warehouse_folder
        if old_path != new_path
          tab.update_columns(warehouse_folder: new_path)
          puts "  ✓ Tab #{tab_id} (#{tab.display_name}): '#{old_path}' → '#{new_path}'"
          updated += 1
        else
          puts "  - Tab #{tab_id} (#{tab.display_name}): already correct"
        end
      else
        errors << "Tab #{tab_id} not found"
      end
    end

    puts ""
    puts "=== Fixing warehouse_type assignments ==="

    # My Documents should be under contact scope (not warehouse)
    tab_369 = WarehouseFolder.find_by(id: 369)
    if tab_369 && tab_369.warehouse_type != "contact"
      old_type = tab_369.warehouse_type
      tab_369.update_columns(warehouse_type: "contact")
      puts "  ✓ Tab 369 (My Documents): warehouse_type '#{old_type}' → 'contact'"
      updated += 1
    elsif tab_369
      puts "  - Tab 369 (My Documents): warehouse_type already 'contact'"
    end

    # Ensure Email Attachments is under email scope
    tab_383 = WarehouseFolder.find_by(id: 383)
    if tab_383 && tab_383.warehouse_type != "email"
      old_type = tab_383.warehouse_type
      tab_383.update_columns(warehouse_type: "email")
      puts "  ✓ Tab 383 (Email Attachments): warehouse_type '#{old_type}' → 'email'"
      updated += 1
    elsif tab_383
      puts "  - Tab 383 (Email Attachments): warehouse_type already 'email'"
    end

    puts ""
    puts "=== Setting parent relationships ==="

    # Set Bank Statements and Contracts as children of Templates
    templates_tab = WarehouseFolder.find_by(tab_key: "templates")
    if templates_tab
      [374, 375].each do |id|
        tab = WarehouseFolder.find_by(id: id)
        if tab && tab.parent_id != templates_tab.id
          old_parent = tab.parent_id
          tab.update_columns(parent_id: templates_tab.id)
          puts "  ✓ Tab #{id} (#{tab.display_name}): parent_id #{old_parent.inspect} → #{templates_tab.id}"
          updated += 1
        elsif tab
          puts "  - Tab #{id} (#{tab.display_name}): parent already set correctly"
        end
      end
    else
      errors << "Templates tab not found"
    end

    puts ""
    puts "=== Summary ==="
    puts "Updated: #{updated} records"
    puts "Errors: #{errors.length}"
    errors.each { |e| puts "  - #{e}" }
    puts ""
    puts "Done!"
  end
end
