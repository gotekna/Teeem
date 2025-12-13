namespace :guard do
  desc "Detect column limiting anti-patterns in API responses"
  task column_limiting: :environment do
    puts "=" * 70
    puts "  COLUMN LIMITING GUARD"
    puts "  Scanning for anti-patterns..."
    puts "=" * 70
    puts ""

    violations = []

    # Pattern 1: .select() in controllers with column limiting
    controllers = Dir.glob("app/controllers/api/v1/**/*_controller.rb")
    controllers.each do |file|
      content = File.read(file)
      lines = content.lines

      lines.each_with_index do |line, idx|
        # Match .select(:id, :name, ...) but not .select { block }
        if line.match?(/\.select\s*\([:\w\s,]+\)/) && !line.include?("# ALLOWED:")
          violations << {
            file: file,
            line: idx + 1,
            pattern: ".select() limiting columns",
            code: line.strip
          }
        end
      end
    end

    # Pattern 2: params[:fields]
    controllers.each do |file|
      content = File.read(file)
      lines = content.lines

      lines.each_with_index do |line, idx|
        if line.include?("params[:fields]") && !line.include?("# ALLOWED:")
          violations << {
            file: file,
            line: idx + 1,
            pattern: "params[:fields] column limiting",
            code: line.strip
          }
        end
      end
    end

    # Pattern 3: as_json(only:) in models and controllers
    files = Dir.glob("app/models/**/*.rb") + controllers
    files.each do |file|
      content = File.read(file)
      lines = content.lines

      lines.each_with_index do |line, idx|
        if line.match?(/only:\s*\[/) && !line.include?("# ALLOWED:") && !line.include?("before_action") && !line.include?("skip_before_action")
          violations << {
            file: file,
            line: idx + 1,
            pattern: "as_json(only:) limiting associations",
            code: line.strip
          }
        end
      end
    end

    # Report
    if violations.empty?
      puts "✅ No column limiting violations found!"
      puts ""
      puts "All APIs return full column sets as required."
    else
      puts "⚠️  Found #{violations.count} column limiting violations:"
      puts ""

      violations.group_by { |v| v[:file] }.each do |file, file_violations|
        puts "#{file}:"
        file_violations.each do |v|
          puts "  Line #{v[:line]}: #{v[:pattern]}"
          puts "    #{v[:code]}"
        end
        puts ""
      end

      puts "=" * 70
      puts "ARCHITECTURAL POLICY: All APIs must return ALL columns"
      puts "Performance via eager loading & pagination, NOT column limiting"
      puts ""
      puts "To allow a specific pattern, add: # ALLOWED: <reason>"
      puts "=" * 70

      exit 1  # Fail CI/CD if violations found
    end
  end
end
