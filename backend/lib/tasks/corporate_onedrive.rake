namespace :corporate do
  namespace :onedrive do
    desc "Create standard folder structure for all companies"
    task create_folders: :environment do
      service = CorporateOneDriveService.new

      Company.where(status: "active").find_each do |company|
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
    task :scan, [ :company_id ] => :environment do |t, args|
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
    task :organise, [ :company_id, :execute ] => :environment do |t, args|
      company = Company.find(args[:company_id])
      service = CorporateOneDriveService.new
      dry_run = args[:execute] != "true"

      puts "Organising documents for: #{company.name}"
      puts dry_run ? "(DRY RUN - no changes will be made)" : "(EXECUTING - files will be moved)"

      result = service.organise_company_documents(company, dry_run: dry_run)

      if result[:success]
        puts "\nTotal documents: #{result[:total_documents]}"
        puts "Actions:"
        result[:actions].group_by { |a| a[:action] }.each do |action, items|
          puts "  #{action}: #{items.count}"
        end

        if result[:actions].any? { |a| a[:action] == "move" }
          puts "\nFiles to move:"
          result[:actions].select { |a| a[:action] == "move" }.each do |action|
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
          { type: "EOY ASIC", description: "End of Year ASIC Statement" },
          { type: "EOY ATO", description: "End of Year ATO Statement" },
          { type: "Solvency ASIC", description: "Solvency Declaration" },
          { type: "ATO Tax Return", description: "Company Tax Return" }
        ],
        setup: [
          { type: "Certificate of Registration", description: "ASIC Registration Certificate" },
          { type: "Constitution", description: "Company Constitution" },
          { type: "Corporate Key", description: "Corporate Key Document" }
        ],
        optional: [
          { type: "Bank Statements", description: "EOY Bank Statements" },
          { type: "Minutes", description: "Annual Solvency Minutes" }
        ]
      }

      # Current and previous financial years
      current_fy = Date.today.month >= 7 ? Date.today.year : Date.today.year - 1
      previous_fy = current_fy - 1

      service = CorporateOneDriveService.new
      total_missing = 0
      company_reports = []

      Company.joins(:company_group).where(status: "active").order("company_groups.name, companies.name").find_each do |company|
        missing = []
        found = []
        documents_with_urls = []

        # Get all documents for this company (with URLs for hyperlinks)
        if company.onedrive_folder_id.present?
          scan = service.scan_company_documents(company)
          if scan[:success]
            documents_with_urls = scan[:documents]
          end
        else
          missing << { type: "OneDrive Folder", year: nil, severity: "high", description: "No OneDrive folder linked", url: nil }
        end

        # Helper to find document and return with URL
        find_doc = ->(pattern) {
          documents_with_urls.find { |d|
            name = d[:name].downcase
            name.include?(pattern.downcase) || name.match?(/#{Regexp.escape(pattern)}/i)
          }
        }

        # Check setup documents
        required_documents[:setup].each do |req|
          doc = find_doc.call(req[:type])
          if doc
            found << req.merge(url: doc[:web_url], name: doc[:name])
          else
            missing << { type: req[:type], year: nil, severity: "medium", description: req[:description], url: nil }
          end
        end

        # Check annual documents for current and previous FY
        [ current_fy, previous_fy ].each do |fy|
          required_documents[:annual].each do |req|
            pattern = "#{req[:type]}.*fy#{fy.to_s[-2..]}"
            alt_pattern = "#{req[:type]}.*#{fy}"

            doc = documents_with_urls.find { |d|
              name = d[:name].downcase
              name.match?(/#{pattern}/i) || name.match?(/#{alt_pattern}/i)
            }

            if doc
              found << req.merge(year: fy, url: doc[:web_url], name: doc[:name])
            else
              missing << {
                type: req[:type],
                year: fy,
                severity: fy == current_fy ? "high" : "medium",
                description: "#{req[:description]} for FY#{fy.to_s[-2..]}",
                url: nil
              }
            end
          end
        end

        # Check bank statements for each bank account
        company.bank_accounts.active.each do |account|
          last4 = account.account_number.last(4)
          [ current_fy, previous_fy ].each do |fy|
            pattern = /eoy.*#{last4}.*fy#{fy.to_s[-2..]}/i
            doc = documents_with_urls.find { |d| d[:name].match?(pattern) }

            if doc
              found << { type: "Bank Statement", year: fy, account: account.display_name, url: doc[:web_url], name: doc[:name] }
            else
              missing << {
                type: "Bank Statement",
                year: fy,
                severity: fy == current_fy ? "medium" : "low",
                description: "EOY #{account.institution_name} #{account.masked_account_number} FY#{fy.to_s[-2..]}",
                url: nil
              }
            end
          end
        end

        # Check for loan documents
        if company.respond_to?(:company_loans) && company.company_loans.exists?
          has_active_loans = company.company_loans.as_lender.active.any? || company.company_loans.as_borrower.active.any? rescue false
          if has_active_loans
            loan_doc = documents_with_urls.find { |d| d[:name].downcase.include?("loan") }
            if loan_doc
              found << { type: "Loan Agreement", url: loan_doc[:web_url], name: loan_doc[:name] }
            else
              missing << { type: "Loan Agreement", year: nil, severity: "high", description: "Loan documents for active loans", url: nil }
            end
          end
        end

        # Get folder URL for the company
        folder_url = nil
        if company.onedrive_folder_id.present?
          first_doc = documents_with_urls.find { |d| d[:web_url].present? }
          if first_doc && first_doc[:web_url]
            folder_url = first_doc[:web_url].split("/").tap { |parts| parts.pop }.join("/") rescue nil
          end
        end

        company_reports << {
          company: company,
          group: company.company_group&.name || "Ungrouped",
          folder_url: folder_url,
          missing: missing,
          found: found,
          found_count: found.count,
          missing_count: missing.count,
          high_severity: missing.count { |m| m[:severity] == "high" },
          medium_severity: missing.count { |m| m[:severity] == "medium" },
          low_severity: missing.count { |m| m[:severity] == "low" }
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
          found = report[:found]

          status = if report[:high_severity] > 0
            "🔴 #{report[:high_severity]} critical"
          elsif report[:medium_severity] > 0
            "🟡 #{report[:medium_severity]} warnings"
          else
            "🟢 OK"
          end

          puts "\n#{company.name} [#{status}]"
          if report[:folder_url]
            puts "📁 OneDrive: #{report[:folder_url]}"
          end
          puts "-"*40

          # Show found documents with hyperlinks
          if found.any?
            puts "  ✅ FOUND (#{found.count}):"
            found.each do |f|
              year_str = f[:year] ? " FY#{f[:year].to_s[-2..]}" : ""
              if f[:url]
                puts "    ✓ #{f[:type]}#{year_str}: #{f[:name]}"
                puts "      🔗 #{f[:url]}"
              else
                puts "    ✓ #{f[:type]}#{year_str}"
              end
            end
          end

          if missing.any?
            # Group by severity
            %w[high medium low].each do |severity|
              items = missing.select { |m| m[:severity] == severity }
              next if items.empty?

              severity_label = { "high" => "🔴 MISSING", "medium" => "🟡 MISSING", "low" => "⚪ Optional" }[severity]
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

    desc "Generate missing documents report as HTML with clickable links"
    task missing_report_html: :environment do
      require "erb"

      # Define required documents per company type
      required_documents = {
        annual: [
          { type: "EOY ASIC", description: "End of Year ASIC Statement" },
          { type: "EOY ATO", description: "End of Year ATO Statement" },
          { type: "Solvency ASIC", description: "Solvency Declaration" },
          { type: "ATO Tax Return", description: "Company Tax Return" }
        ],
        setup: [
          { type: "Certificate of Registration", description: "ASIC Registration Certificate" },
          { type: "Constitution", description: "Company Constitution" },
          { type: "Corporate Key", description: "Corporate Key Document" }
        ],
        optional: [
          { type: "Bank Statements", description: "EOY Bank Statements" },
          { type: "Minutes", description: "Annual Solvency Minutes" }
        ]
      }

      current_fy = Date.today.month >= 7 ? Date.today.year : Date.today.year - 1
      previous_fy = current_fy - 1

      service = CorporateOneDriveService.new
      company_reports = []

      Company.joins(:company_group).where(status: "active").order("company_groups.name, companies.name").find_each do |company|
        missing = []
        found = []
        documents_with_urls = []

        if company.onedrive_folder_id.present?
          scan = service.scan_company_documents(company)
          documents_with_urls = scan[:success] ? scan[:documents] : []
        else
          missing << { type: "OneDrive Folder", severity: "high", description: "No OneDrive folder linked", url: nil }
        end

        find_doc = ->(pattern) {
          documents_with_urls.find { |d| d[:name].downcase.include?(pattern.downcase) || d[:name].downcase.match?(/#{Regexp.escape(pattern)}/i) }
        }

        required_documents[:setup].each do |req|
          doc = find_doc.call(req[:type])
          if doc
            found << req.merge(url: doc[:web_url], name: doc[:name])
          else
            missing << { type: req[:type], severity: "medium", description: req[:description], url: nil }
          end
        end

        [ current_fy, previous_fy ].each do |fy|
          required_documents[:annual].each do |req|
            pattern = "#{req[:type]}.*fy#{fy.to_s[-2..]}"
            doc = documents_with_urls.find { |d| d[:name].downcase.match?(/#{pattern}/i) }
            if doc
              found << req.merge(year: fy, url: doc[:web_url], name: doc[:name])
            else
              missing << { type: req[:type], year: fy, severity: fy == current_fy ? "high" : "medium", description: "#{req[:description]} FY#{fy.to_s[-2..]}", url: nil }
            end
          end
        end

        company.bank_accounts.active.each do |account|
          last4 = account.account_number.last(4)
          [ current_fy, previous_fy ].each do |fy|
            pattern = /eoy.*#{last4}.*fy#{fy.to_s[-2..]}/i
            doc = documents_with_urls.find { |d| d[:name].match?(pattern) }
            if doc
              found << { type: "Bank Statement", year: fy, account: account.display_name, url: doc[:web_url], name: doc[:name] }
            else
              missing << { type: "Bank Statement", year: fy, severity: fy == current_fy ? "medium" : "low", description: "EOY #{account.institution_name} #{account.masked_account_number} FY#{fy.to_s[-2..]}", url: nil }
            end
          end
        end

        folder_url = nil
        if company.onedrive_folder_id.present?
          first_doc = documents_with_urls.find { |d| d[:web_url].present? }
          folder_url = first_doc[:web_url].split("/").tap { |p| p.pop }.join("/") rescue nil if first_doc
        end

        company_reports << {
          company: company,
          group: company.company_group&.name || "Ungrouped",
          folder_url: folder_url,
          missing: missing,
          found: found,
          high_severity: missing.count { |m| m[:severity] == "high" },
          medium_severity: missing.count { |m| m[:severity] == "medium" },
          low_severity: missing.count { |m| m[:severity] == "low" }
        }
      end

      # Generate HTML report
      html = <<~HTML
        <!DOCTYPE html>
        <html>
        <head>
          <title>Corporate Documents - Missing Files Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            h2 { color: #374151; margin-top: 30px; }
            .company-card { background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .company-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .company-name { font-size: 18px; font-weight: 600; color: #1a1a1a; }
            .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
            .status-critical { background: #fee2e2; color: #dc2626; }
            .status-warning { background: #fef3c7; color: #d97706; }
            .status-ok { background: #d1fae5; color: #059669; }
            .folder-link { color: #3b82f6; text-decoration: none; font-size: 14px; }
            .folder-link:hover { text-decoration: underline; }
            .section { margin: 10px 0; }
            .section-title { font-weight: 600; color: #374151; margin-bottom: 8px; }
            .doc-list { list-style: none; padding: 0; margin: 0; }
            .doc-item { padding: 8px 12px; margin: 4px 0; border-radius: 4px; display: flex; align-items: center; gap: 10px; }
            .doc-found { background: #f0fdf4; }
            .doc-missing-high { background: #fef2f2; }
            .doc-missing-medium { background: #fffbeb; }
            .doc-missing-low { background: #f9fafb; }
            .doc-link { color: #3b82f6; text-decoration: none; font-size: 13px; }
            .doc-link:hover { text-decoration: underline; }
            .summary { background: white; border-radius: 8px; padding: 20px; margin-top: 30px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; }
            .summary-item { padding: 15px; }
            .summary-value { font-size: 32px; font-weight: 700; color: #1a1a1a; }
            .summary-label { color: #6b7280; font-size: 14px; }
            .generated { color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Corporate Documents - Missing Files Report</h1>
            <p class="generated">Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}</p>
      HTML

      company_reports.group_by { |r| r[:group] }.each do |group_name, reports|
        html += "<h2>#{ERB::Util.html_escape(group_name)}</h2>\n"

        reports.sort_by { |r| -r[:high_severity] }.each do |report|
          company = report[:company]
          status_class = if report[:high_severity] > 0
            "status-critical"
          elsif report[:medium_severity] > 0
            "status-warning"
          else
            "status-ok"
          end
          status_text = if report[:high_severity] > 0
            "#{report[:high_severity]} critical"
          elsif report[:medium_severity] > 0
            "#{report[:medium_severity]} warnings"
          else
            "OK"
          end

          html += <<~CARD
            <div class="company-card">
              <div class="company-header">
                <span class="company-name">#{ERB::Util.html_escape(company.name)}</span>
                <span class="status-badge #{status_class}">#{status_text}</span>
              </div>
          CARD

          if report[:folder_url]
            html += "<a href=\"#{ERB::Util.html_escape(report[:folder_url])}\" target=\"_blank\" class=\"folder-link\">Open OneDrive Folder</a>\n"
          end

          if report[:found].any?
            html += "<div class=\"section\"><div class=\"section-title\">Found Documents (#{report[:found].count})</div><ul class=\"doc-list\">\n"
            report[:found].each do |doc|
              year_str = doc[:year] ? " FY#{doc[:year].to_s[-2..]}" : ""
              html += "<li class=\"doc-item doc-found\">#{ERB::Util.html_escape(doc[:type])}#{year_str}"
              html += " <a href=\"#{ERB::Util.html_escape(doc[:url])}\" target=\"_blank\" class=\"doc-link\">Open</a>" if doc[:url]
              html += "</li>\n"
            end
            html += "</ul></div>\n"
          end

          if report[:missing].any?
            html += "<div class=\"section\"><div class=\"section-title\">Missing Documents (#{report[:missing].count})</div><ul class=\"doc-list\">\n"
            report[:missing].each do |doc|
              css_class = "doc-missing-#{doc[:severity]}"
              html += "<li class=\"doc-item #{css_class}\">#{ERB::Util.html_escape(doc[:description])}</li>\n"
            end
            html += "</ul></div>\n"
          end

          html += "</div>\n"
        end
      end

      total_missing = company_reports.sum { |r| r[:missing].count }
      html += <<~SUMMARY
            <div class="summary">
              <h2>Summary</h2>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-value">#{company_reports.count}</div>
                  <div class="summary-label">Total Companies</div>
                </div>
                <div class="summary-item">
                  <div class="summary-value">#{total_missing}</div>
                  <div class="summary-label">Missing Documents</div>
                </div>
                <div class="summary-item">
                  <div class="summary-value">#{company_reports.count { |r| r[:high_severity] > 0 }}</div>
                  <div class="summary-label">Critical Issues</div>
                </div>
                <div class="summary-item">
                  <div class="summary-value">#{company_reports.count { |r| r[:missing].empty? }}</div>
                  <div class="summary-label">Fully Compliant</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      SUMMARY

      # Save to file
      output_path = Rails.root.join("tmp", "corporate_missing_report.html")
      File.write(output_path, html)
      puts "HTML report generated: #{output_path}"
      puts "Open in browser: file://#{output_path}"

      # Also try to open in default browser on macOS
      system("open #{output_path}") if RUBY_PLATFORM.include?("darwin")
    end

    desc "Sync OneDrive documents to database for a company"
    task :sync_db, [ :company_id ] => :environment do |t, args|
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

    desc "Reorganise and rename all documents in OneDrive to standard naming convention"
    task :reorganise_all, [ :execute ] => :environment do |t, args|
      dry_run = args[:execute] != "true"
      service = CorporateOneDriveService.new

      puts "="*80
      puts "CORPORATE DOCUMENTS - REORGANISE & RENAME"
      puts "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}"
      puts dry_run ? "(DRY RUN - no changes will be made)" : "(EXECUTING - files will be moved and renamed)"
      puts "="*80

      total_actions = { moved: 0, renamed: 0, skipped: 0, errors: 0 }

      Company.joins(:company_group).where(status: "active").order("company_groups.name, companies.name").find_each do |company|
        next unless company.onedrive_folder_id.present?

        puts "\n#{company.name}"
        puts "-"*40

        result = service.organise_company_documents(company, dry_run: dry_run)

        if result[:success]
          result[:actions].each do |action|
            case action[:action]
            when "move"
              total_actions[:moved] += 1
              puts "  📁 MOVE: #{action[:file]} -> #{action[:target_folder]}"
              puts "      Result: #{action[:result]}" unless dry_run
            when "skip"
              total_actions[:skipped] += 1
            end
          end

          # Also try to rename files to standard convention
          scan = service.scan_company_documents(company)
          if scan[:success]
            scan[:documents].each do |doc|
              next if doc[:is_folder]

              # Check if file needs renaming
              new_name = suggest_standard_name(doc[:name], company)
              if new_name && new_name != doc[:name]
                puts "  ✏️  RENAME: #{doc[:name]}"
                puts "          -> #{new_name}"

                unless dry_run
                  begin
                    service.client.patch(
                      "/drives/#{service.client.instance_variable_get(:@credential).drive_id}/items/#{doc[:id]}",
                      { name: new_name }
                    )
                    total_actions[:renamed] += 1
                    puts "      Result: success"
                  rescue => e
                    total_actions[:errors] += 1
                    puts "      Result: FAILED - #{e.message}"
                  end
                else
                  total_actions[:renamed] += 1
                end
              end
            end
          end
        else
          puts "  Error: #{result[:error]}"
          total_actions[:errors] += 1
        end
      end

      puts "\n" + "="*80
      puts "SUMMARY"
      puts "="*80
      puts "Files moved: #{total_actions[:moved]}"
      puts "Files renamed: #{total_actions[:renamed]}"
      puts "Files skipped (already correct): #{total_actions[:skipped]}"
      puts "Errors: #{total_actions[:errors]}"
      puts "\nTo execute changes, run: rails corporate:onedrive:reorganise_all[true]" if dry_run
    end

    desc "Rename documents in a company folder to standard naming convention"
    task :rename, [ :company_id, :execute ] => :environment do |t, args|
      company = Company.find(args[:company_id])
      service = CorporateOneDriveService.new
      dry_run = args[:execute] != "true"

      puts "Renaming documents for: #{company.name}"
      puts dry_run ? "(DRY RUN - no changes will be made)" : "(EXECUTING - files will be renamed)"
      puts "-"*40

      return puts "Error: No OneDrive folder linked" unless company.onedrive_folder_id.present?

      scan = service.scan_company_documents(company)
      return puts "Error: #{scan[:error]}" unless scan[:success]

      renamed = 0
      skipped = 0
      errors = 0

      scan[:documents].each do |doc|
        next if doc[:is_folder]

        new_name = suggest_standard_name(doc[:name], company)
        if new_name && new_name != doc[:name]
          puts "  ✏️  #{doc[:name]}"
          puts "  ->  #{new_name}"

          unless dry_run
            begin
              service.client.patch(
                "/drives/#{service.client.instance_variable_get(:@credential).drive_id}/items/#{doc[:id]}",
                { name: new_name }
              )
              renamed += 1
              puts "      ✓ Renamed"
            rescue => e
              errors += 1
              puts "      ✗ Error: #{e.message}"
            end
          else
            renamed += 1
          end
        else
          skipped += 1
        end
      end

      puts "\nRenamed: #{renamed}, Skipped: #{skipped}, Errors: #{errors}"
      puts "To execute changes, run: rails corporate:onedrive:rename[#{company.id},true]" if dry_run
    end

    # Helper method to suggest standard file name
    def suggest_standard_name(filename, company)
      # Standard format: {Company Code} - {YYYY-MM-DD} - {Document Type} - {Description}.{ext}
      # Example: GEN 2612 - 2024-06-30 - Constitution - Amended.pdf
      extension = File.extname(filename)
      basename = File.basename(filename, ".*")

      # Try to extract date from filename
      date_match = basename.match(/(\d{4}[-_]\d{2}[-_]\d{2})|FY(\d{2,4})|(\d{1,2})[-_](\d{1,2})[-_](\d{2,4})/)
      date = nil

      if date_match
        if date_match[1]
          date = Date.parse(date_match[1].gsub("_", "-")) rescue nil
        elsif date_match[2]
          fy = date_match[2].to_i
          fy = 2000 + fy if fy < 100
          date = Date.new(fy, 6, 30)
        elsif date_match[3] && date_match[4] && date_match[5]
          year = date_match[5].to_i
          year = 2000 + year if year < 100
          date = Date.new(year, date_match[4].to_i, date_match[3].to_i) rescue nil
        end
      end

      # Detect document type
      doc_type = detect_document_type_from_name(basename)
      return nil unless doc_type

      # Build description
      description = basename
        .gsub(/\d{4}[-_]\d{2}[-_]\d{2}/, "")
        .gsub(/FY\d{2,4}/i, "")
        .gsub(/\d{1,2}[-_]\d{1,2}[-_]\d{2,4}/, "")
        .gsub(doc_type, "")
        .gsub(company.name, "")
        .gsub(company.code || "", "")
        .gsub(/[-_]+/, " ")
        .strip
        .squeeze(" ")

      # Build new filename
      date_str = date ? date.strftime("%Y-%m-%d") : Date.today.strftime("%Y-%m-%d")

      # Use code as single source of truth
      company_identifier = company.code.presence || company.name.split.map(&:first).join.upcase

      new_name = "#{company_identifier} - #{date_str} - #{doc_type}"
      new_name += " - #{description}" if description.present? && description.length > 2
      new_name += extension

      # Don't suggest rename if already in standard format (starts with company code pattern)
      return nil if filename.match?(/^[A-Z]{2,4}\s*\d{0,5}\s*-\s*\d{4}-\d{2}-\d{2}/)

      new_name
    end

    def detect_document_type_from_name(filename)
      filename_lower = filename.downcase

      type_keywords = {
        "Constitution" => %w[constitution],
        "Certificate of Registration" => %w[certificate registration cert reg],
        "Corporate Key" => %w[corporate key],
        "Loan Agreement" => %w[loan agreement],
        "Security Deed" => %w[security deed],
        "PPSR" => %w[ppsr personal property],
        "ATO Tax Return" => %w[tax return itr],
        "BAS" => %w[bas activity statement],
        "Solvency ASIC" => %w[solvency 484],
        "EOY ASIC" => %w[eoy asic annual return],
        "EOY ATO" => %w[eoy ato],
        "Minutes" => %w[minutes meeting resolution],
        "Distribution" => %w[distribution],
        "Dividends" => %w[dividend],
        "Bank Statement" => %w[bank statement],
        "Trust Deed" => %w[trust deed],
        "Officers" => %w[officer director secretary appointment resignation 484],
        "Assets" => %w[asset register depreciation]
      }

      type_keywords.each do |type, keywords|
        return type if keywords.any? { |kw| filename_lower.include?(kw) }
      end

      nil
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
      Company.where(status: "active").find_each do |company|
        next if company.onedrive_folder_id.present?

        # Try to find matching folder
        folder_patterns = [
          company.name,
          company.code,
          "#{company.code} - #{company.name}",
          company.name.split.first
        ].compact.map(&:downcase)

        matching_folder = root_items["value"]&.find do |item|
          item["folder"] && folder_patterns.any? { |p| item["name"].downcase.include?(p) }
        end

        if matching_folder
          company.update(
            onedrive_folder_id: matching_folder["id"],
            onedrive_folder_path: matching_folder["name"]
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
