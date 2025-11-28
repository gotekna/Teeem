namespace :corporate do
  namespace :onedrive do
    desc "Create standard folder structure for all companies"
    task create_folders: :environment do
      service = CorporateOneDriveService.new

      Company.where(status: 'active').find_each do |company|
        puts "Creating folders for: #{company.name}"
        result = service.create_company_folders(company)

        if result[:success]
          puts "  ✓ Created folder: #{result[:folder_name]}"
          puts "  Folders created: #{result[:stats][:folders_created]}"
          puts "  Folders skipped (already exist): #{result[:stats][:folders_skipped]}"
        else
          puts "  ✗ Error: #{result[:error]}"
        end
      end
    end

    desc "Scan and report on documents for a company"
    task :scan, [:company_id] => :environment do |t, args|
      company = Company.find(args[:company_id])
      service = CorporateOneDriveService.new

      puts "Scanning documents for: #{company.name}"
      result = service.scan_company_documents(company)

      if result[:success]
        puts "Total documents: #{result[:total_documents]}"
        puts "\nBy Category:"
        result[:categorised].each do |category, docs|
          puts "  #{category}: #{docs.count} documents"
          docs.first(3).each { |d| puts "    - #{d[:name]}" }
          puts "    ... and #{docs.count - 3} more" if docs.count > 3
        end
      else
        puts "Error: #{result[:error]}"
      end
    end

    desc "Organise documents for a company (dry_run by default)"
    task :organise, [:company_id, :execute] => :environment do |t, args|
      company = Company.find(args[:company_id])
      service = CorporateOneDriveService.new
      dry_run = args[:execute] != 'true'

      puts "Organising documents for: #{company.name}"
      puts dry_run ? "(DRY RUN - no changes will be made)" : "(EXECUTING - files will be moved)"

      result = service.organise_company_documents(company, dry_run: dry_run)

      if result[:success]
        puts "\nTotal documents: #{result[:total_documents]}"
        puts "Actions:"
        result[:actions].group_by { |a| a[:action] }.each do |action, items|
          puts "  #{action}: #{items.count}"
        end

        if result[:actions].any? { |a| a[:action] == 'move' }
          puts "\nFiles to move:"
          result[:actions].select { |a| a[:action] == 'move' }.each do |action|
            puts "  #{action[:file]} -> #{action[:target_folder]}"
            puts "    Result: #{action[:result]}" if action[:result]
          end
        end
      else
        puts "Error: #{result[:error]}"
      end
    end

    desc "Generate missing documents report for all companies"
    task missing_report: :environment do
      puts "="*80
      puts "CORPORATE DOCUMENTS - MISSING FILES REPORT"
      puts "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}"
      puts "="*80

      # Define required documents per company type
      required_documents = {
        annual: [
          { type: 'EOY ASIC', description: 'End of Year ASIC Statement' },
          { type: 'EOY ATO', description: 'End of Year ATO Statement' },
          { type: 'Solvency ASIC', description: 'Solvency Declaration' },
          { type: 'ATO Tax Return', description: 'Company Tax Return' }
        ],
        setup: [
          { type: 'Certificate of Registration', description: 'ASIC Registration Certificate' },
          { type: 'Constitution', description: 'Company Constitution' },
          { type: 'Corporate Key', description: 'Corporate Key Document' }
        ],
        optional: [
          { type: 'Bank Statements', description: 'EOY Bank Statements' },
          { type: 'Minutes', description: 'Annual Solvency Minutes' }
        ]
      }

      # Current and previous financial years
      current_fy = Date.today.month >= 7 ? Date.today.year : Date.today.year - 1
      previous_fy = current_fy - 1

      service = CorporateOneDriveService.new
      total_missing = 0
      company_reports = []

      Company.joins(:company_group).where(status: 'active').order('company_groups.name, companies.name').find_each do |company|
        missing = []
        found = []

        # Get all documents for this company
        if company.onedrive_folder_id.present?
          scan = service.scan_company_documents(company)
          documents = scan[:success] ? scan[:documents].map { |d| d[:name].downcase } : []
        else
          documents = []
          missing << { type: 'OneDrive Folder', year: nil, severity: 'high', description: 'No OneDrive folder linked' }
        end

        # Check setup documents
        required_documents[:setup].each do |req|
          if documents.any? { |d| d.include?(req[:type].downcase) }
            found << req
          else
            missing << { type: req[:type], year: nil, severity: 'medium', description: req[:description] }
          end
        end

        # Check annual documents for current and previous FY
        [current_fy, previous_fy].each do |fy|
          required_documents[:annual].each do |req|
            pattern = "#{req[:type].downcase} fy#{fy.to_s[-2..]}"
            alt_pattern = "#{req[:type].downcase}.*#{fy}"

            if documents.any? { |d| d.include?(pattern) || d.match?(/#{alt_pattern}/i) }
              found << req.merge(year: fy)
            else
              missing << {
                type: req[:type],
                year: fy,
                severity: fy == current_fy ? 'high' : 'medium',
                description: "#{req[:description]} for FY#{fy.to_s[-2..]}"
              }
            end
          end
        end

        # Check bank statements for each bank account
        company.bank_accounts.active.each do |account|
          pattern = "eoy.*#{account.account_number.last(4)}"
          [current_fy, previous_fy].each do |fy|
            if documents.any? { |d| d.match?(/#{pattern}.*fy#{fy.to_s[-2..]}/i) }
              found << { type: 'Bank Statement', year: fy, account: account.display_name }
            else
              missing << {
                type: 'Bank Statement',
                year: fy,
                severity: fy == current_fy ? 'medium' : 'low',
                description: "EOY #{account.institution_name} #{account.masked_account_number} FY#{fy.to_s[-2..]}"
              }
            end
          end
        end

        # Check for loan documents
        if company.company_loans.as_lender.active.any? || company.company_loans.as_borrower.active.any?
          has_loan_docs = documents.any? { |d| d.include?('loan') }
          unless has_loan_docs
            missing << { type: 'Loan Agreement', year: nil, severity: 'high', description: 'Loan documents for active loans' }
          end
        end

        company_reports << {
          company: company,
          group: company.company_group&.name || 'Ungrouped',
          missing: missing,
          found: found.count,
          missing_count: missing.count,
          high_severity: missing.count { |m| m[:severity] == 'high' },
          medium_severity: missing.count { |m| m[:severity] == 'medium' },
          low_severity: missing.count { |m| m[:severity] == 'low' }
        }

        total_missing += missing.count
      end

      # Group by company group and output report
      company_reports.group_by { |r| r[:group] }.each do |group_name, reports|
        puts "\n" + "="*80
        puts "GROUP: #{group_name}"
        puts "="*80

        reports.sort_by { |r| -r[:high_severity] }.each do |report|
          company = report[:company]
          missing = report[:missing]

          status = if report[:high_severity] > 0
            "🔴 #{report[:high_severity]} critical"
          elsif report[:medium_severity] > 0
            "🟡 #{report[:medium_severity]} warnings"
          else
            "🟢 OK"
          end

          puts "\n#{company.name} [#{status}]"
          puts "-"*40

          if missing.any?
            # Group by severity
            %w[high medium low].each do |severity|
              items = missing.select { |m| m[:severity] == severity }
              next if items.empty?

              severity_label = { 'high' => '🔴 MISSING', 'medium' => '🟡 MISSING', 'low' => '⚪ Optional' }[severity]
              puts "  #{severity_label}:"
              items.each do |m|
                puts "    - #{m[:description]}"
              end
            end
          else
            puts "  ✓ All required documents present"
          end
        end
      end

      # Summary
      puts "\n" + "="*80
      puts "SUMMARY"
      puts "="*80
      puts "Total companies: #{company_reports.count}"
      puts "Total missing documents: #{total_missing}"
      puts "Companies with critical issues: #{company_reports.count { |r| r[:high_severity] > 0 }}"
      puts "Companies fully compliant: #{company_reports.count { |r| r[:missing_count] == 0 }}"
    end

    desc "Sync OneDrive documents to database for a company"
    task :sync_db, [:company_id] => :environment do |t, args|
      company = Company.find(args[:company_id])
      service = CorporateOneDriveService.new

      puts "Syncing documents to database for: #{company.name}"

      return puts "Error: No OneDrive folder linked" unless company.onedrive_folder_id.present?

      scan = service.scan_company_documents(company)
      return puts "Error: #{scan[:error]}" unless scan[:success]

      synced = 0
      errors = 0

      scan[:documents].each do |doc|
        next if doc[:is_folder]

        begin
          service.sync_document_to_database(company, doc[:id])
          synced += 1
          puts "  ✓ #{doc[:name]}"
        rescue => e
          errors += 1
          puts "  ✗ #{doc[:name]}: #{e.message}"
        end
      end

      puts "\nSynced: #{synced}, Errors: #{errors}"
    end

    desc "Link existing OneDrive folders to companies based on folder names"
    task link_folders: :environment do
      puts "Linking OneDrive folders to companies..."

      # This task scans the OneDrive Corporate File folder and matches
      # companies by name/abbreviation

      service = CorporateOneDriveService.new
      client = service.instance_variable_get(:@client)

      # Get root corporate folder
      # Adjust this path based on your OneDrive structure
      root_items = client.list_folder_items rescue nil

      if root_items.nil?
        puts "Could not connect to OneDrive. Ensure credentials are configured."
        return
      end

      linked = 0
      Company.where(status: 'active').find_each do |company|
        next if company.onedrive_folder_id.present?

        # Try to find matching folder
        folder_patterns = [
          company.name,
          company.abbreviation,
          "#{company.abbreviation} - #{company.name}",
          company.name.split.first
        ].compact.map(&:downcase)

        matching_folder = root_items['value']&.find do |item|
          item['folder'] && folder_patterns.any? { |p| item['name'].downcase.include?(p) }
        end

        if matching_folder
          company.update(
            onedrive_folder_id: matching_folder['id'],
            onedrive_folder_path: matching_folder['name']
          )
          linked += 1
          puts "  ✓ #{company.name} -> #{matching_folder['name']}"
        else
          puts "  ✗ #{company.name}: No matching folder found"
        end
      end

      puts "\nLinked #{linked} companies"
    end
  end
end
