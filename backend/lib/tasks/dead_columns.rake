# frozen_string_literal: true

# Dead Column & Table Detector
#
# Scans the codebase to find database tables and columns that are no longer
# referenced in application code. Combines code search with DB data checks
# to classify findings by confidence level.
#
# Usage:
#   rails db:dead_tables                    # Find unused tables
#   rails db:dead_columns                   # Find unused columns
#   rails db:dead_columns[warehouse_documents]  # Focus on one table
#   rails db:dead_all                       # Run both together
#
# Safe: read-only, no data changes.

namespace :db do
  # ─── Constants ───────────────────────────────────────────────────────

  # Columns that are always implicitly used by Rails/gems - never report these
  UNIVERSAL_COLUMNS = %w[
    id created_at updated_at tenant_id type
    created_by_id updated_by_id deleted_at discarded_at
    position lock_version
  ].freeze

  # Column names too common to reliably detect via grep (would match everything)
  AMBIGUOUS_COLUMN_NAMES = %w[
    name status email title description value key label code
    active enabled data metadata notes content body message
    slug path url token role scope kind category source
    amount total count level priority order text comment
    state mode format version number date time
  ].freeze

  # Framework/Rails internal tables
  FRAMEWORK_TABLES = %w[
    schema_migrations ar_internal_metadata
    active_storage_blobs active_storage_attachments active_storage_variant_records
    solid_queue_blocked_executions solid_queue_claimed_executions
    solid_queue_failed_executions solid_queue_jobs solid_queue_pauses
    solid_queue_processes solid_queue_ready_executions
    solid_queue_recurring_executions solid_queue_recurring_tasks
    solid_queue_scheduled_executions solid_queue_semaphores
  ].freeze

  # Directories to search for code references
  SEARCH_DIRS = %w[
    backend/app
    backend/lib
    backend/config/routes.rb
    frontend-next/app
    frontend-next/components
    frontend-next/lib
  ].freeze

  # Files/dirs to exclude from search
  SEARCH_EXCLUDES = %w[
    backend/db/schema.rb
    backend/db/migrate
    backend/db/seeds
    node_modules
    .next
    backend/lib/tasks/dead_columns.rake
  ].freeze

  # ─── Helpers ─────────────────────────────────────────────────────────

  def parse_schema_tables
    schema_path = Rails.root.join("db", "schema.rb")
    content = File.read(schema_path)

    tables = {}
    current_table = nil
    current_columns = []

    content.each_line do |line|
      if line =~ /create_table\s+"([^"]+)"/
        # Save previous table
        tables[current_table] = current_columns if current_table
        current_table = $1
        current_columns = []
      elsif current_table && line =~ /t\.\w+\s+"([^"]+)"/
        current_columns << $1
      elsif current_table && line =~ /^\s+end\s*$/
        tables[current_table] = current_columns
        current_table = nil
        current_columns = []
      end
    end

    tables
  end

  def model_file_exists?(table_name)
    # Try standard singularization
    model_name = table_name.singularize
    model_file = Rails.root.join("app", "models", "#{model_name}.rb")
    return true if File.exist?(model_file)

    # Try with subdirectories (e.g., concerns, nested models)
    Dir.glob(Rails.root.join("app", "models", "**", "#{model_name}.rb")).any?
  end

  def get_model_associations(table_name)
    model_name = table_name.classify
    begin
      klass = model_name.constantize
      belongs_to_cols = []

      if klass.respond_to?(:reflect_on_all_associations)
        klass.reflect_on_all_associations(:belongs_to).each do |assoc|
          belongs_to_cols << assoc.foreign_key.to_s
          # Polymorphic adds _type column too
          belongs_to_cols << "#{assoc.name}_type" if assoc.options[:polymorphic]
        end
      end

      belongs_to_cols
    rescue NameError, LoadError
      []
    end
  end

  def grep_code_references(search_term, exact_column: false)
    root = Rails.root.join("..").to_s  # monorepo root

    # Build exclude args
    exclude_args = SEARCH_EXCLUDES.map { |e| "--exclude-dir=#{e}" }.join(" ")

    # Build patterns to search for
    # For columns, search for the name as symbol, string key, method call, hash key
    if exact_column
      patterns = [
        "\\b#{Regexp.escape(search_term)}\\b"  # word boundary match
      ]
    else
      patterns = [
        ":#{Regexp.escape(search_term)}\\b",           # :column_name (Ruby symbol)
        "\"#{Regexp.escape(search_term)}\"",            # "column_name" (string)
        "\\.#{Regexp.escape(search_term)}[^a-zA-Z_]",  # .column_name (method call)
        "#{Regexp.escape(search_term)}:",               # column_name: (hash key)
        "'#{Regexp.escape(search_term)}'",              # 'column_name' (single-quoted string)
      ]
    end

    search_paths = SEARCH_DIRS.map { |d| File.join(root, d) }.select { |d| File.exist?(d) }
    return 0 if search_paths.empty?

    total_refs = 0
    ref_files = Set.new

    patterns.each do |pattern|
      cmd = "grep -rl #{exclude_args} " \
            "--include='*.rb' --include='*.ts' --include='*.tsx' " \
            "--include='*.rake' --include='*.yml' --include='*.yaml' " \
            "-E '#{pattern}' #{search_paths.join(' ')} 2>/dev/null"

      result = `#{cmd}`.strip
      result.each_line { |f| ref_files << f.strip } unless result.empty?
    end

    ref_files.size
  end

  def count_non_null(table_name, column_name)
    result = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) AS cnt FROM \"#{table_name}\" WHERE \"#{column_name}\" IS NOT NULL"
    )
    result.first["cnt"].to_i
  rescue => e
    -1  # error (table might not exist, column might be virtual, etc.)
  end

  def table_row_count(table_name)
    result = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) AS cnt FROM \"#{table_name}\""
    )
    result.first["cnt"].to_i
  rescue => e
    -1
  end

  def format_number(n)
    return "error" if n < 0
    n.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
  end

  # ─── Task: Dead Tables ──────────────────────────────────────────────

  desc "Find database tables with no model or code references"
  task dead_tables: :environment do
    puts "\n=========================================="
    puts "DEAD TABLE DETECTOR"
    puts "=========================================="
    puts "Started: #{Time.current.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M:%S')} Brisbane"
    puts ""

    tables = parse_schema_tables
    dead_tables = []
    checked = 0

    tables.each_key do |table_name|
      next if FRAMEWORK_TABLES.include?(table_name)

      checked += 1
      print "\r  Checking table #{checked}/#{tables.size}: #{table_name.ljust(50)}"

      has_model = model_file_exists?(table_name)
      code_refs = grep_code_references(table_name, exact_column: true)

      if !has_model && code_refs == 0
        row_count = table_row_count(table_name)
        dead_tables << {
          table: table_name,
          columns: tables[table_name].size,
          rows: row_count
        }
      end
    end

    print "\r#{' ' * 80}\r"  # clear progress line

    puts "\n=========================================="
    puts "RESULTS: POTENTIALLY DEAD TABLES"
    puts "==========================================\n"

    if dead_tables.empty?
      puts "  No dead tables found! All #{checked} tables have code references."
    else
      # Sort: empty tables first (safest to remove), then by name
      dead_tables.sort_by! { |t| [t[:rows] == 0 ? 0 : 1, t[:table]] }

      dead_tables.each do |t|
        rows_str = t[:rows] >= 0 ? "#{format_number(t[:rows])} rows" : "error counting"
        puts "  #{t[:table].ljust(45)} #{t[:columns]} cols, #{rows_str}"
      end
    end

    puts "\n=========================================="
    puts "Summary: #{dead_tables.size} potentially dead tables (of #{checked} checked)"
    empty_count = dead_tables.count { |t| t[:rows] == 0 }
    puts "  #{empty_count} are empty (safe to drop)"
    puts "  #{dead_tables.size - empty_count} have data (need migration plan)"
    puts "==========================================\n"
  end

  # ─── Task: Dead Columns ─────────────────────────────────────────────

  desc "Find database columns with no code references (optionally pass table name)"
  task :dead_columns, [:table_filter] => :environment do |_t, args|
    table_filter = args[:table_filter]

    puts "\n=========================================="
    puts "DEAD COLUMN DETECTOR"
    puts "=========================================="
    puts "Started: #{Time.current.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M:%S')} Brisbane"
    puts "Filter: #{table_filter || 'all tables'}"
    puts ""

    tables = parse_schema_tables

    # Apply filter if provided
    if table_filter
      tables = tables.select { |name, _| name == table_filter }
      if tables.empty?
        puts "  Table '#{table_filter}' not found in schema.rb"
        next
      end
    end

    results_high = []    # 0 code refs, has data
    results_empty = []   # 0 code refs, no data (safe to drop)
    results_ambiguous = [] # skipped due to common name
    total_checked = 0
    total_skipped_universal = 0
    total_skipped_fk = 0
    total_skipped_ambiguous = 0
    tables_processed = 0

    tables.each do |table_name, columns|
      next if FRAMEWORK_TABLES.include?(table_name)

      tables_processed += 1
      print "\r  Scanning #{tables_processed}/#{tables.size}: #{table_name.ljust(50)}"

      # Get belongs_to foreign keys for this table (implicitly used)
      fk_columns = get_model_associations(table_name)

      columns.each do |col|
        # Skip universal columns
        if UNIVERSAL_COLUMNS.include?(col)
          total_skipped_universal += 1
          next
        end

        # Skip foreign keys from belongs_to associations
        if fk_columns.include?(col)
          total_skipped_fk += 1
          next
        end

        # Skip ambiguous/common column names (too many false positives)
        if AMBIGUOUS_COLUMN_NAMES.include?(col)
          total_skipped_ambiguous += 1
          results_ambiguous << { table: table_name, column: col }
          next
        end

        total_checked += 1
        code_refs = grep_code_references(col)

        next if code_refs > 0

        # No code references found - check DB data
        non_null = count_non_null(table_name, col)

        entry = {
          table: table_name,
          column: col,
          code_refs: code_refs,
          non_null_count: non_null
        }

        if non_null == 0
          results_empty << entry
        else
          results_high << entry
        end
      end
    end

    print "\r#{' ' * 80}\r"  # clear progress line

    # ─── Print Report ────────────────────────────────────────────────

    puts "\n=========================================="
    puts "RESULTS"
    puts "==========================================\n"

    puts "Tables scanned:              #{tables_processed}"
    puts "Columns checked:             #{format_number(total_checked)}"
    puts "Skipped (universal):         #{format_number(total_skipped_universal)}"
    puts "Skipped (belongs_to FK):     #{format_number(total_skipped_fk)}"
    puts "Skipped (ambiguous name):    #{format_number(total_skipped_ambiguous)}"
    puts ""

    # ── UNUSED + EMPTY (safe to drop) ──
    if results_empty.any?
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts "UNUSED & EMPTY — Safe to drop (0 code refs, 0 data)"
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

      results_empty.sort_by { |r| [r[:table], r[:column]] }.group_by { |r| r[:table] }.each do |table, cols|
        puts "\n  #{table}:"
        cols.each do |c|
          puts "    #{c[:column]}"
        end
      end
      puts ""
    end

    # ── UNUSED + HAS DATA (needs investigation) ──
    if results_high.any?
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts "UNUSED BUT HAS DATA — Needs investigation (0 code refs, has data)"
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

      results_high.sort_by { |r| [-r[:non_null_count], r[:table], r[:column]] }.group_by { |r| r[:table] }.each do |table, cols|
        puts "\n  #{table}:"
        cols.each do |c|
          nn = c[:non_null_count] >= 0 ? format_number(c[:non_null_count]) : "error"
          puts "    #{c[:column].ljust(40)} #{nn} non-null rows"
        end
      end
      puts ""
    end

    if results_empty.empty? && results_high.empty?
      puts "  No dead columns found! All checked columns have code references."
      puts ""
    end

    # ── AMBIGUOUS (skipped) ──
    if results_ambiguous.any? && table_filter
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts "SKIPPED — Common column names (manual review)"
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

      results_ambiguous.group_by { |r| r[:table] }.each do |table, cols|
        puts "\n  #{table}:"
        cols.each { |c| puts "    #{c[:column]}" }
      end
      puts ""
    end

    puts "=========================================="
    total_dead = results_empty.size + results_high.size
    puts "Total: #{total_dead} potentially dead columns"
    puts "  #{results_empty.size} empty (safe to drop)"
    puts "  #{results_high.size} have data (investigate before dropping)"
    puts "  #{results_ambiguous.size} skipped (ambiguous names)"
    puts "==========================================\n"
  end

  # ─── Task: Run Both ─────────────────────────────────────────────────

  desc "Run dead table and dead column detection together"
  task dead_all: :environment do
    Rake::Task["db:dead_tables"].invoke
    Rake::Task["db:dead_columns"].invoke
  end
end
