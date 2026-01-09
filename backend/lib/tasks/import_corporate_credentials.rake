namespace :corporate do
  desc "Import corporate credentials from Corporate File.xlsx (run on Heroku with proper encryption)"
  task import_credentials: :environment do
    require "roo"

    puts "Importing Corporate Credentials from Corporate File.xlsx"
    puts "=" * 80

    # This file needs to be uploaded to Heroku tmp directory first
    # OR we can fetch it from a URL if needed
    file_path = ENV["CORPORATE_FILE_PATH"] || "/tmp/Corporate File.xlsx"

    unless File.exist?(file_path)
      puts "ERROR: File not found: #{file_path}"
      puts "Please upload the file first or set CORPORATE_FILE_PATH environment variable"
      exit 1
    end

    spreadsheet = Roo::Spreadsheet.open(file_path)

    unless spreadsheet.sheets.include?("All Companies")
      puts "ERROR: 'All Companies' sheet not found!"
      exit 1
    end

    sheet = spreadsheet.sheet("All Companies")

    # Verify headers
    headers = sheet.row(1)
    puts "Headers found:"
    headers.each_with_index { |h, i| puts "  Col #{i}: #{h}" if h.present? }
    puts "\n" + "=" * 80

    stats = {
      updated: 0,
      skipped: 0,
      not_found: 0,
      errors: []
    }

    # Process each row (starting from row 2)
    (2..sheet.last_row).each do |row_num|
      begin
        row = sheet.row(row_num)

        # Extract data
        group_name = row[0].to_s.strip
        company_name = row[1].to_s.strip
        review_date = row[2]
        acn = row[3].to_s.gsub(/\s+/, "").strip # Remove spaces from ACN
        abn = row[4].to_s.gsub(/\s+/, "").strip # Remove spaces from ABN
        tfn = row[5].to_s.strip
        director_name = row[6].to_s.strip
        established_date = row[7]
        corporate_key = row[8].to_s.strip
        asic_username = row[9].to_s.strip
        asic_password = row[10].to_s.strip
        recovery_question = row[11].to_s.strip
        recovery_answer = row[12].to_s.strip

        next if company_name.blank?

        puts "\nProcessing: #{company_name}"

        # Find company - try multiple strategies
        company = nil

        # 1. Try exact ACN match first (most reliable)
        if acn.present? && acn.length == 9
          company = Company.find_by(acn: acn)
          puts "  Found by ACN: #{acn}" if company
        end

        # 2. Try by name (remove Pty Ltd, ATF, etc.)
        unless company
          search_name = company_name.gsub(/\s+pty\s+ltd.*$/i, "").gsub(/\s+atf\s+.*$/i, "").strip
          company = Company.find_by("LOWER(name) LIKE ?", "%#{search_name.downcase}%")
          puts "  Found by name search: #{search_name}" if company
        end

        # 3. Try exact name match
        unless company
          company = Company.find_by("LOWER(name) = ?", company_name.downcase)
          puts "  Found by exact name" if company
        end

        unless company
          puts "  ❌ Company not found: #{company_name} (ACN: #{acn})"
          stats[:not_found] += 1
          next
        end

        # Prepare updates
        updates = {}

        # Parse dates
        if review_date.present?
          begin
            parsed_date = case review_date
            when Date, DateTime, Time then review_date.to_date
            when String then Date.parse(review_date) rescue nil
            when Numeric then Date.new(1899, 12, 30) + review_date.to_i
            else nil
            end
            updates[:review_date] = parsed_date if parsed_date
          rescue => e
            puts "  Warning: Could not parse review_date: #{review_date}"
          end
        end

        if established_date.present?
          begin
            parsed_date = case established_date
            when Date, DateTime, Time then established_date.to_date
            when String then Date.parse(established_date) rescue nil
            when Numeric then Date.new(1899, 12, 30) + established_date.to_i
            else nil
            end
            updates[:date_incorporated] = parsed_date if parsed_date && company.date_incorporated.blank?
          rescue => e
            puts "  Warning: Could not parse established_date: #{established_date}"
          end
        end

        # Add credentials
        updates[:corporate_key] = corporate_key if corporate_key.present?
        updates[:asic_username] = asic_username if asic_username.present?
        updates[:encrypted_asic_password] = asic_password if asic_password.present?
        updates[:recovery_question] = recovery_question if recovery_question.present?
        updates[:encrypted_recovery_answer] = recovery_answer if recovery_answer.present?

        # Update TFN if blank
        updates[:tfn] = tfn if tfn.present? && company.tfn.blank?

        if updates.any?
          company.update!(updates)
          stats[:updated] += 1
          puts "  ✅ Updated: #{updates.keys.join(', ')}"
        else
          stats[:skipped] += 1
          puts "  ⏭  Skipped: No new data"
        end

      rescue StandardError => e
        stats[:errors] << "Row #{row_num} (#{company_name}): #{e.message}"
        puts "  ❌ Error: #{e.message}"
      end
    end

    # Recalculate health scores (corporate_key is part of health calculation)
    puts "\n" + "=" * 80
    puts "Recalculating health scores..."
    puts "=" * 80

    Company.find_each do |company|
      result = company.calculate_health!
      puts "  #{company.name}: #{result[:score]}% (#{result[:status]})"
    end

    # Summary
    puts "\n" + "=" * 80
    puts "IMPORT COMPLETE - SUMMARY"
    puts "=" * 80
    puts "Companies updated: #{stats[:updated]}"
    puts "Companies skipped: #{stats[:skipped]}"
    puts "Companies not found: #{stats[:not_found]}"

    puts "\n=== Health Score Summary ==="
    by_status = Company.group(:health_status).count
    by_status.each { |status, count| puts "#{status}: #{count}" }
    avg = Company.average(:health_score)
    puts "Average score: #{avg&.round(1)}%"

    if stats[:errors].any?
      puts "\n=== Errors (#{stats[:errors].count}) ==="
      stats[:errors].each { |e| puts "  - #{e}" }
    end

    puts "\n✅ Done!"
  end
end
