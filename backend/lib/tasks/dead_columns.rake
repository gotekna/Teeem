# frozen_string_literal: true

# Dead Column & Table Detector v2
#
# Finds genuinely dead database columns and tables — columns/tables that have
# been REPLACED or ABANDONED, not just "unused features".
#
# Key safeguards:
#   - Tables with model files are NEVER flagged as dead (they're real features)
#   - Foundation-backed columns (from `columns` table) are excluded
#   - camelCase variants are searched in frontend code
#   - Columns on Foundation-backed tables need BOTH no code refs AND no Foundation column
#   - Results use confidence levels, never say "safe to drop"
#
# Usage:
#   rails db:dead_tables                           # Find truly orphaned tables
#   rails db:dead_columns                          # Find dead columns (high confidence only)
#   rails db:dead_columns[warehouse_documents]     # Focus on one table
#   rails db:dead_all                              # Run both
#
# Safe: read-only, no data changes.

namespace :db do
  # ─── Constants ───────────────────────────────────────────────────────

  # Columns always implicitly used by Rails/gems — never report
  UNIVERSAL_COLUMNS = %w[
    id created_at updated_at tenant_id type
    created_by_id updated_by_id created_by_name updated_by_name
    deleted_at discarded_at position lock_version
  ].freeze

  # Column names too common to search reliably
  AMBIGUOUS_COLUMN_NAMES = %w[
    name status email title description value key label code
    active enabled data metadata notes content body message
    slug path url token role scope kind category source
    amount total count level priority order text comment
    state mode format version number date time
  ].freeze

  # Framework/Rails internal tables — always skip
  FRAMEWORK_TABLES = %w[
    schema_migrations ar_internal_metadata
    active_storage_blobs active_storage_attachments active_storage_variant_records
    solid_queue_blocked_executions solid_queue_claimed_executions
    solid_queue_failed_executions solid_queue_jobs solid_queue_pauses
    solid_queue_processes solid_queue_ready_executions
    solid_queue_recurring_executions solid_queue_recurring_tasks
    solid_queue_scheduled_executions solid_queue_semaphores
    solid_cache_entries
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

  # Find model class for a table, checking multiple naming conventions
  def find_model_for_table(table_name)
    candidates = [
      table_name.classify,
      table_name.singularize.camelize
    ].uniq

    candidates.each do |class_name|
      begin
        klass = class_name.constantize
        return klass if klass < ActiveRecord::Base
      rescue NameError, LoadError
        # Not found
      end
    end

    # Fallback: check descendants
    ActiveRecord::Base.descendants.find { |m| (m.table_name == table_name) rescue false }
  end

  # Check if a model file exists on disk (doesn't require loading)
  def model_file_exists?(table_name)
    model_name = table_name.singularize
    path = Rails.root.join("app", "models", "#{model_name}.rb")
    return true if File.exist?(path)

    # Check subdirectories and namespace patterns
    # e.g., gl_invoices -> gl/invoice.rb or gl_invoice.rb
    parts = model_name.split("_")
    if parts.size > 1
      # Try namespace: gl_invoice -> gl/invoice.rb
      ns_path = Rails.root.join("app", "models", parts[0], "#{parts[1..-1].join('_')}.rb")
      return true if File.exist?(ns_path)
    end

    Dir.glob(Rails.root.join("app", "models", "**", "#{model_name}.rb")).any?
  end

  def get_model_associations(table_name)
    model = find_model_for_table(table_name)
    return [] unless model

    cols = []
    model.reflect_on_all_associations(:belongs_to).each do |assoc|
      cols << assoc.foreign_key.to_s
      cols << "#{assoc.name}_type" if assoc.options[:polymorphic]
    end
    cols
  rescue => e
    []
  end

  # Load all Foundation column names — these are dynamically accessed
  def load_foundation_column_names
    return @foundation_columns if defined?(@foundation_columns)
    @foundation_columns = Column.pluck(:column_name).uniq.to_set
  rescue => e
    @foundation_columns = Set.new
  end

  # Load Foundation-backed table names (tables that have a Foundation)
  def load_foundation_table_names
    return @foundation_tables if defined?(@foundation_tables)
    @foundation_tables = Foundation.pluck(:table_name).uniq.to_set
  rescue => e
    @foundation_tables = Set.new
  end

  # Convert snake_case to camelCase for frontend matching
  def to_camel_case(snake_str)
    parts = snake_str.split("_")
    parts[0] + parts[1..].map(&:capitalize).join
  end

  # Search for column references in backend code (on Heroku, only backend is available)
  def grep_column_refs(col_name)
    exclude_args = %w[
      db/schema.rb db/migrate db/seeds lib/tasks/dead_columns.rake
    ].map { |e| "--exclude-dir=#{e}" }.join(" ")

    # Search patterns: :col, "col", .col, col:, 'col'
    patterns = [
      ":#{Regexp.escape(col_name)}\\b",
      "\"#{Regexp.escape(col_name)}\"",
      "\\.#{Regexp.escape(col_name)}[^a-zA-Z_]",
      "#{Regexp.escape(col_name)}:",
      "'#{Regexp.escape(col_name)}'"
    ]

    # Also search camelCase variant for frontend patterns in backend
    camel = to_camel_case(col_name)
    if camel != col_name
      patterns << "\"#{Regexp.escape(camel)}\""
      patterns << "'#{Regexp.escape(camel)}'"
      patterns << "#{Regexp.escape(camel)}[^a-zA-Z_]"
    end

    search_dirs = %w[app lib config].map { |d| Rails.root.join(d).to_s }.select { |d| Dir.exist?(d) }
    ref_files = Set.new

    patterns.each do |pattern|
      cmd = "grep -rl #{exclude_args} " \
            "--include='*.rb' --include='*.rake' --include='*.yml' " \
            "-E '#{pattern}' #{search_dirs.join(' ')} 2>/dev/null"
      result = `#{cmd}`.strip
      result.each_line { |f| ref_files << f.strip } unless result.empty?
    end

    ref_files.size
  end

  # Search for a table name in code (for dead table detection)
  def grep_table_refs(table_name)
    search_dirs = %w[app lib config].map { |d| Rails.root.join(d).to_s }.select { |d| Dir.exist?(d) }

    # Search for table name as string, symbol, or in SQL
    pattern = "\\b#{Regexp.escape(table_name)}\\b"

    cmd = "grep -rl --include='*.rb' --include='*.rake' " \
          "-E '#{pattern}' #{search_dirs.join(' ')} 2>/dev/null"
    result = `#{cmd}`.strip
    result.empty? ? 0 : result.lines.count
  end

  def count_non_null(table_name, column_name)
    result = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) AS cnt FROM \"#{table_name}\" WHERE \"#{column_name}\" IS NOT NULL"
    )
    result.first["cnt"].to_i
  rescue => e
    -1
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
    return "error" if n.nil? || n < 0
    n.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
  end

  # ─── Task: Dead Tables ──────────────────────────────────────────────

  desc "Find truly orphaned database tables (no model, no code, no Foundation)"
  task dead_tables: :environment do
    puts "\n#{"=" * 70}"
    puts "DEAD TABLE DETECTOR v2"
    puts "=" * 70
    puts "Started: #{Time.current.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M:%S')} Brisbane"
    puts ""

    # Eager-load models so descendants work
    Rails.application.eager_load!

    tables = parse_schema_tables
    foundation_tables = load_foundation_table_names

    truly_dead = []      # No model, no code, no Foundation
    has_model_empty = []  # Has model but 0 rows (unused feature, NOT dead)
    checked = 0
    skipped_framework = 0
    skipped_has_model = 0
    skipped_has_foundation = 0
    skipped_has_code = 0

    tables.each_key do |table_name|
      if FRAMEWORK_TABLES.include?(table_name)
        skipped_framework += 1
        next
      end

      checked += 1
      print "\r  Checking table #{checked}/#{tables.size}: #{table_name.ljust(50)}"

      # 1. Has a model file? → NOT dead (it's a real feature)
      if model_file_exists?(table_name)
        skipped_has_model += 1
        row_count = table_row_count(table_name)
        has_model_empty << { table: table_name, columns: tables[table_name].size } if row_count == 0
        next
      end

      # 2. Has a Foundation? → NOT dead (it's Foundation-backed)
      if foundation_tables.include?(table_name)
        skipped_has_foundation += 1
        next
      end

      # 3. Referenced in code? → NOT dead
      code_refs = grep_table_refs(table_name)
      if code_refs > 0
        skipped_has_code += 1
        next
      end

      # Passes all checks — this table is genuinely orphaned
      row_count = table_row_count(table_name)
      truly_dead << {
        table: table_name,
        columns: tables[table_name].size,
        rows: row_count
      }
    end

    print "\r#{' ' * 80}\r"

    # ─── Report ──────────────────────────────────────────────────

    puts "\n#{"=" * 70}"
    puts "RESULTS"
    puts "=" * 70
    puts "Tables in schema:            #{tables.size}"
    puts "Skipped (framework):         #{skipped_framework}"
    puts "Skipped (has model file):    #{skipped_has_model}"
    puts "Skipped (has Foundation):    #{skipped_has_foundation}"
    puts "Skipped (has code refs):     #{skipped_has_code}"
    puts ""

    if truly_dead.any?
      dead_empty = truly_dead.select { |t| t[:rows] == 0 }
      dead_with_data = truly_dead.select { |t| t[:rows] > 0 }

      if dead_empty.any?
        puts "TRULY ORPHANED — No model, no Foundation, no code refs, no data:"
        puts "(These tables have NO model file, NO Foundation, and NO code references)"
        puts ""
        dead_empty.sort_by { |t| t[:table] }.each do |t|
          puts "  #{t[:table].ljust(50)} #{t[:columns]} columns"
        end
        puts ""
      end

      if dead_with_data.any?
        puts "ORPHANED BUT HAS DATA — No model/Foundation/code but still has rows:"
        puts "(May be leftover data from removed features — investigate before dropping)"
        puts ""
        dead_with_data.sort_by { |t| [-t[:rows], t[:table]] }.each do |t|
          puts "  #{t[:table].ljust(50)} #{t[:columns]} cols, #{format_number(t[:rows])} rows"
        end
        puts ""
      end
    else
      puts "No orphaned tables found."
      puts ""
    end

    if has_model_empty.any?
      puts "INFO: #{has_model_empty.size} tables have a model but 0 rows (unused features, NOT dead):"
      has_model_empty.sort_by { |t| t[:table] }.first(10).each do |t|
        puts "  #{t[:table].ljust(50)} #{t[:columns]} columns"
      end
      puts "  ... and #{has_model_empty.size - 10} more" if has_model_empty.size > 10
      puts ""
    end

    puts "=" * 70
    puts "Truly orphaned: #{truly_dead.size} tables"
    puts "  #{truly_dead.count { |t| t[:rows] == 0 }} empty"
    puts "  #{truly_dead.count { |t| t[:rows] > 0 }} with data"
    puts "=" * 70
    puts ""
  end

  # ─── Task: Dead Columns ─────────────────────────────────────────────

  desc "Find dead columns — replaced or abandoned, not just unused features"
  task :dead_columns, [:table_filter] => :environment do |_t, args|
    table_filter = args[:table_filter].presence

    puts "\n#{"=" * 70}"
    puts "DEAD COLUMN DETECTOR v2"
    puts "=" * 70
    puts "Started: #{Time.current.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M:%S')} Brisbane"
    puts "Filter: #{table_filter || 'all tables'}"
    puts ""

    # Eager-load models
    Rails.application.eager_load!

    tables = parse_schema_tables
    foundation_columns = load_foundation_column_names
    foundation_tables = load_foundation_table_names

    if table_filter
      tables = tables.select { |name, _| name == table_filter }
      if tables.empty?
        puts "  Table '#{table_filter}' not found in schema.rb"
        next
      end
    end

    results_high_confidence = []  # No model + no code + no Foundation column
    results_medium = []           # Has model, but column not in code or Foundation
    results_ambiguous = []        # Skipped (common name)
    stats = {
      tables_processed: 0,
      columns_checked: 0,
      skipped_universal: 0,
      skipped_fk: 0,
      skipped_ambiguous: 0,
      skipped_foundation_col: 0,
      skipped_has_refs: 0
    }

    tables.each do |table_name, columns|
      next if FRAMEWORK_TABLES.include?(table_name)

      stats[:tables_processed] += 1
      print "\r  Scanning #{stats[:tables_processed]}/#{tables.size}: #{table_name.ljust(50)}"

      has_model = model_file_exists?(table_name)
      is_foundation_table = foundation_tables.include?(table_name)
      fk_columns = get_model_associations(table_name)

      columns.each do |col|
        # Skip universal columns
        if UNIVERSAL_COLUMNS.include?(col)
          stats[:skipped_universal] += 1
          next
        end

        # Skip foreign keys from belongs_to
        if fk_columns.include?(col)
          stats[:skipped_fk] += 1
          next
        end

        # Skip ambiguous names
        if AMBIGUOUS_COLUMN_NAMES.include?(col) || col.length < 3
          stats[:skipped_ambiguous] += 1
          results_ambiguous << { table: table_name, column: col }
          next
        end

        # Skip columns defined in Foundation columns table
        if foundation_columns.include?(col)
          stats[:skipped_foundation_col] += 1
          next
        end

        stats[:columns_checked] += 1

        # Check code references
        code_refs = grep_column_refs(col)

        if code_refs > 0
          stats[:skipped_has_refs] += 1
          next
        end

        # No code refs found — check DB for data
        non_null = count_non_null(table_name, col)

        entry = {
          table: table_name,
          column: col,
          non_null_count: non_null,
          has_model: has_model,
          is_foundation_table: is_foundation_table
        }

        # Confidence level:
        # HIGH = no model file (truly orphaned table's column)
        # MEDIUM = has model but column not referenced anywhere
        if has_model
          results_medium << entry
        else
          results_high_confidence << entry
        end
      end
    end

    print "\r#{' ' * 80}\r"

    # ─── Report ──────────────────────────────────────────────────

    puts "\n#{"=" * 70}"
    puts "RESULTS"
    puts "=" * 70
    puts "Tables scanned:              #{stats[:tables_processed]}"
    puts "Columns checked:             #{format_number(stats[:columns_checked])}"
    puts "Skipped (universal):         #{format_number(stats[:skipped_universal])}"
    puts "Skipped (belongs_to FK):     #{format_number(stats[:skipped_fk])}"
    puts "Skipped (Foundation column): #{format_number(stats[:skipped_foundation_col])}"
    puts "Skipped (ambiguous name):    #{format_number(stats[:skipped_ambiguous])}"
    puts "Skipped (has code refs):     #{format_number(stats[:skipped_has_refs])}"
    puts ""

    # HIGH CONFIDENCE: Table has no model — columns are definitely unused
    high_with_data = results_high_confidence.select { |e| e[:non_null_count] > 0 }
    high_empty = results_high_confidence.select { |e| e[:non_null_count] == 0 }

    if high_with_data.any?
      puts "HIGH CONFIDENCE — Orphaned table columns with stale data"
      puts "(Table has NO model file. These columns are on genuinely orphaned tables.)"
      puts ""
      high_with_data.sort_by { |e| [-e[:non_null_count], e[:table], e[:column]] }
        .group_by { |e| e[:table] }.each do |table, cols|
        puts "  #{table}:"
        cols.each do |c|
          puts "    #{c[:column].ljust(45)} #{format_number(c[:non_null_count])} rows"
        end
        puts ""
      end
    end

    if high_empty.any?
      puts "HIGH CONFIDENCE — Orphaned table columns, empty"
      puts "(Table has NO model file and columns have no data.)"
      puts ""
      count_by_table = high_empty.group_by { |e| e[:table] }.transform_values(&:size)
      count_by_table.sort_by { |t, _| t }.each do |table, col_count|
        puts "  #{table.ljust(50)} #{col_count} dead columns"
      end
      puts ""
    end

    # MEDIUM CONFIDENCE: Table has a model but column not found in code/Foundation
    medium_with_data = results_medium.select { |e| e[:non_null_count] > 0 }
    medium_empty = results_medium.select { |e| e[:non_null_count] == 0 }

    if medium_with_data.any?
      puts "MEDIUM CONFIDENCE — Column not in code but table has a model"
      puts "(May be accessed dynamically, via serialization, or from frontend.)"
      puts "(Review carefully — these could be replaced columns with stale data.)"
      puts ""
      medium_with_data.sort_by { |e| [-e[:non_null_count], e[:table], e[:column]] }
        .group_by { |e| e[:table] }.each do |table, cols|
        puts "  #{table}#{cols.first[:is_foundation_table] ? ' [Foundation]' : ''}:"
        cols.each do |c|
          puts "    #{c[:column].ljust(45)} #{format_number(c[:non_null_count])} rows"
        end
        puts ""
      end
    end

    if medium_empty.any? && (table_filter || medium_empty.size <= 50)
      puts "MEDIUM CONFIDENCE — Column not in code, empty, table has model"
      puts "(Likely scaffolded but never used. Low priority.)"
      puts ""
      medium_empty.sort_by { |e| [e[:table], e[:column]] }
        .group_by { |e| e[:table] }.each do |table, cols|
        puts "  #{table}#{cols.first[:is_foundation_table] ? ' [Foundation]' : ''}:"
        cols.each { |c| puts "    #{c[:column]}" }
        puts ""
      end
    elsif medium_empty.any?
      puts "MEDIUM CONFIDENCE — #{medium_empty.size} empty columns on active tables (not shown)"
      puts "(Run with table filter to see details: rails db:dead_columns[table_name])"
      puts ""
    end

    # SKIPPED
    if results_ambiguous.any? && table_filter
      puts "SKIPPED — Common column names (manual review needed):"
      results_ambiguous.group_by { |r| r[:table] }.each do |table, cols|
        puts "  #{table}: #{cols.map { |c| c[:column] }.join(', ')}"
      end
      puts ""
    end

    puts "=" * 70
    total_flagged = results_high_confidence.size + results_medium.size
    puts "Flagged: #{total_flagged} columns"
    puts "  HIGH confidence (orphaned table): #{results_high_confidence.size}"
    puts "    #{high_with_data.size} with data | #{high_empty.size} empty"
    puts "  MEDIUM confidence (active table):  #{results_medium.size}"
    puts "    #{medium_with_data.size} with data | #{medium_empty.size} empty"
    puts "  Skipped (ambiguous):               #{results_ambiguous.size}"
    puts "=" * 70
    puts ""
  end

  # ─── Task: Run Both ─────────────────────────────────────────────────

  desc "Run dead table and dead column detection together"
  task dead_all: :environment do
    Rake::Task["db:dead_tables"].invoke
    Rake::Task["db:dead_columns"].invoke
  end
end
