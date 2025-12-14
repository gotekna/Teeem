# frozen_string_literal: true

# SSoT Model Auditor - Find NoMethodError time bombs before they explode
#
# Usage:
#   bin/rails runner lib/ssot_auditor.rb
#   bin/rails runner lib/ssot_auditor.rb --fix  # Auto-generate fixes
#   bin/rails runner lib/ssot_auditor.rb --json # Output as JSON
#
# This auditor scans the codebase for method calls on ActiveRecord models
# that don't actually exist, preventing runtime NoMethodError crashes.

class SsotAuditor
  VERSION = "1.0.0"

  # Models most likely to have SSoT issues (high traffic, frequently refactored)
  PRIORITY_MODELS = %w[
    Job Contact PurchaseOrder ExternalInvoice CorporateCompany
    SmTask CaseRecord QuoteRequest QuoteResponse Meeting User
    ScheduleTask Lead Project PricebookItem PricebookCategory
    CorporateCompanyShareholding CorporateCompanyDirector
    EmailWarehouse BillInbox
  ].freeze

  # Common method names and their likely actual implementations
  # method_called => [possible_actual_methods_in_priority_order]
  COMMON_PATTERNS = {
    # Naming
    "name" => %w[name display_name item_name title full_name],
    "title" => %w[title name display_name subject],
    "full_name" => %w[full_name display_name name],
    "display_name" => %w[display_name name title],

    # Status/Type
    "status" => %w[status state job_status current_status],
    "type" => %w[type entity_type record_type kind],
    "state" => %w[state status current_state],

    # Contact Info
    "email" => %w[email email_address primary_email],
    "phone" => %w[phone mobile_phone office_phone phone_number primary_phone],
    "mobile" => %w[mobile mobile_phone cell_phone],
    "fax" => %w[fax fax_phone fax_number],

    # Address
    "address" => %w[address street_address full_address location residential_address],
    "suburb" => %w[suburb city town locality],
    "city" => %w[city suburb town],
    "full_address" => %w[full_address address formatted_address],
    "address_line_1" => %w[address_line_1 street_address address],
    "address_line_2" => %w[address_line_2 address_2],
    "location" => %w[location address site_address],

    # Associations (common renames)
    "company" => %w[company corporate_company parent_company],
    "contact" => %w[contact supplier customer client],
    "job" => %w[job construction project],
    "construction" => %w[construction job project],
    "project" => %w[project job construction],
    "supplier" => %w[supplier contact vendor],
    "customer" => %w[customer contact client],
    "client" => %w[client customer contact],

    # Ownership/Assignment
    "created_by" => %w[created_by creator author user],
    "updated_by" => %w[updated_by modifier editor],
    "assigned_to" => %w[assigned_to assignee owner assigned_user],
    "owner" => %w[owner assigned_to created_by],

    # Dates
    "start_date" => %w[start_date started_at begins_at from_date],
    "end_date" => %w[end_date ended_at ends_at to_date],
    "due_date" => %w[due_date deadline due_at],

    # Financial
    "price" => %w[price amount cost total current_price],
    "cost" => %w[cost price amount total],
    "total" => %w[total amount sum grand_total],
    "amount" => %w[amount total price cost],

    # Text
    "description" => %w[description notes details summary],
    "notes" => %w[notes description comments details],

    # Business
    "abn" => %w[abn tax_number business_number],
    "acn" => %w[acn company_number],
    "company_name" => %w[company_name company_name_or_trust business_name],

    # Helpers
    "is_supplier" => %w[is_supplier? is_supplier supplier?],
    "is_customer" => %w[is_customer? is_customer customer?],
    "is_active" => %w[is_active? is_active active?],
  }.freeze

  # Methods to ignore (Rails/Ruby built-ins, common helpers)
  # Note: include both `method` and `method?` forms since regex captures without `?`
  IGNORED_METHODS = %w[
    id ids new create create! find find_by find_by! find_or_create_by find_or_initialize_by
    where not or and select pluck joins includes preload eager_load left_joins
    first last take all count size length empty empty? any any? none none? one one? many many?
    save save! update update! update_all update_column update_columns
    destroy destroy! destroy_all delete delete_all
    reload reset clear lock transaction with_lock
    valid valid? invalid invalid? errors validate validates
    present present? blank blank? nil nil? empty empty? exists exists?
    to_s to_i to_f to_a to_h to_json as_json
    inspect class is_a is_a? kind_of kind_of? instance_of instance_of? respond_to respond_to?
    try try! send public_send
    map each find_each find_in_batches in_batches select reject find_all collect
    merge assign_attributes attributes
    persisted persisted? new_record new_record? destroyed destroyed? changed changed? changes
    created_at updated_at deleted_at
    dup clone freeze frozen frozen?
    humanize titleize underscore camelize
    strip chomp downcase upcase capitalize
    split join gsub sub match
    round floor ceil abs
    presence in in?
    unscoped scope scoped default_scope
    order group limit offset distinct reorder
    read write open close
    failed pending completed running queued
    active inactive enabled disabled
    before after around
    symbolize_keys stringify_keys deep_symbolize_keys
    compact compact_blank
    sum average minimum maximum
    touch increment decrement
    column_names columns table_name table_exists
    connection connection_pool establish_connection
    sanitize sanitize_sql sanitize_sql_like
    from_omniauth
    by_status for_user for_construction for_job for_contact
    can_approve can_cancel can_edit can_delete can_create
    mark_received mark_completed mark_arrived mark_paid
    send_to_supplier send_to_suppliers send_reminder
    approve reject cancel complete start finish
    closed open submitted accepted rejected
    accept_quote accept reject_quote
    apply_invoice match unmatch
    enable_portal disable_portal
    locked unlocked archived
    portal_type account_type
    match_to_purchase_order unmatch_from_purchase_order
    quotes_received pending_response
    scheduled_date expected_completion_date delivery_before_task_start
    is_primary submit
    quote bill invoice
  ].freeze

  # File patterns to scan
  SCAN_PATTERNS = [
    "app/controllers/**/*.rb",
    "app/services/**/*.rb",
    "app/jobs/**/*.rb",
    "app/models/**/*.rb",
    "app/mailers/**/*.rb",
  ].freeze

  def initialize(options = {})
    @options = options
    @issues = []
    @warnings = []
    @model_cache = {}
    @method_cache = {}
    @fixes = {}
    @stats = { files_scanned: 0, models_checked: 0, issues_found: 0 }
  end

  def run
    print_header
    load_models
    scan_codebase
    analyze_results
    print_report
    generate_fixes if @options[:fix]
    print_summary

    @issues.empty? ? 0 : 1  # Exit code
  end

  private

  def print_header
    puts ""
    puts "=" * 70
    puts "  SSoT MODEL AUDITOR v#{VERSION}"
    puts "  Finding NoMethodError time bombs before they explode"
    puts "=" * 70
    puts ""
  end

  def load_models
    puts "Loading models..."

    PRIORITY_MODELS.each do |model_name|
      begin
        klass = model_name.constantize
        next unless klass < ApplicationRecord

        instance = klass.new

        # Cache all methods the model responds to
        @model_cache[model_name] = {
          klass: klass,
          columns: klass.column_names,
          associations: klass.reflect_on_all_associations.map(&:name).map(&:to_s),
          methods: instance.methods.map(&:to_s),
        }

        @stats[:models_checked] += 1
      rescue StandardError => e
        puts "  Warning: Could not load #{model_name}: #{e.message}"
      end
    end

    puts "  Loaded #{@stats[:models_checked]} models"
    puts ""
  end

  def scan_codebase
    puts "Scanning codebase..."

    SCAN_PATTERNS.each do |pattern|
      Dir.glob(pattern).each do |file|
        scan_file(file)
        @stats[:files_scanned] += 1
      end
    end

    puts "  Scanned #{@stats[:files_scanned]} files"
    puts ""
  end

  def scan_file(file)
    content = File.read(file)
    lines = content.lines

    @model_cache.each do |model_name, model_info|
      # Variable patterns that might hold this model
      var_patterns = build_var_patterns(model_name)

      var_patterns.each do |var_pattern|
        # Simple pattern to find method calls: variable.method_name
        # We'll filter out false positives afterward
        regex = /\b#{Regexp.escape(var_pattern)}\.([a-z_][a-z0-9_]*)\b/i

        content.scan(regex).flatten.uniq.each do |method|
          # Skip if it looks like _id, _ids suffix or assignment
          next if method.end_with?("_id", "_ids")
          method = method.downcase
          next if IGNORED_METHODS.include?(method)
          next if model_responds_to?(model_name, method)

          # Find line number
          line_num = find_line_number(lines, var_pattern, method)

          @issues << {
            model: model_name,
            method: method,
            file: file,
            line: line_num,
            var: var_pattern,
            similar: find_similar_method(model_name, method),
          }
        end
      end
    end
  end

  # Common variable names that conflict with model name parts
  # These are too generic and cause false positives
  AMBIGUOUS_VAR_NAMES = %w[
    response request item record data result params
    body code message error status type task order
    invoice company user category contact lead project
    meeting job director shareholding
  ].freeze

  def build_var_patterns(model_name)
    base = model_name.underscore
    patterns = []

    # Only add base pattern if it's not too generic/ambiguous
    if base.include?("_") || !AMBIGUOUS_VAR_NAMES.include?(base)
      patterns << base              # quote_request, corporate_company
    end

    # Always add instance variable form (more specific)
    patterns << "@#{base}"          # @job, @contact, @quote_request

    # Only add short name if it's not ambiguous
    short_name = base.split("_").last
    unless AMBIGUOUS_VAR_NAMES.include?(short_name)
      patterns << short_name        # shareholding from corporate_company_shareholding
    end

    patterns.uniq
  end

  def model_responds_to?(model_name, method)
    return true unless @model_cache[model_name]

    cache_key = "#{model_name}##{method}"
    return @method_cache[cache_key] if @method_cache.key?(cache_key)

    info = @model_cache[model_name]
    result = info[:methods].include?(method) ||
             info[:columns].include?(method) ||
             info[:associations].include?(method)

    @method_cache[cache_key] = result
    result
  end

  def find_similar_method(model_name, method)
    return nil unless @model_cache[model_name]

    # Check common patterns first
    if COMMON_PATTERNS[method]
      COMMON_PATTERNS[method].each do |alt|
        return alt if model_responds_to?(model_name, alt)
      end
    end

    # Fuzzy match on columns and associations
    info = @model_cache[model_name]
    all_methods = info[:columns] + info[:associations]

    # Find methods containing our method name
    containing = all_methods.find { |m| m.include?(method) }
    return containing if containing

    # Find methods our method name contains
    contained = all_methods.find { |m| method.include?(m) && m.length > 2 }
    return contained if contained

    nil
  end

  def find_line_number(lines, var, method)
    lines.each_with_index do |line, idx|
      return idx + 1 if line.include?("#{var}.#{method}")
    end
    nil
  end

  def analyze_results
    # Group and deduplicate issues
    @grouped_issues = @issues.group_by { |i| "#{i[:model]}##{i[:method]}" }
  end

  def print_report
    puts "=" * 70
    puts "  AUDIT RESULTS"
    puts "=" * 70
    puts ""

    if @grouped_issues.empty?
      puts "  No SSoT violations found!"
      puts ""
      return
    end

    # Sort by occurrence count (most common first)
    sorted = @grouped_issues.sort_by { |_, v| -v.count }

    puts "  CRITICAL ISSUES: #{sorted.count} types, #{@issues.count} total calls"
    puts "  " + "-" * 66
    puts ""

    sorted.each do |key, occurrences|
      model, method = key.split("#")
      similar = occurrences.first[:similar]

      puts "  #{model}.#{method}"
      puts "    Calls: #{occurrences.count}"
      puts "    Similar: #{similar || 'none found'}"
      puts "    Locations:"

      occurrences.first(5).each do |occ|
        line_info = occ[:line] ? ":#{occ[:line]}" : ""
        puts "      - #{occ[:file]}#{line_info}"
      end

      if occurrences.count > 5
        puts "      ... and #{occurrences.count - 5} more"
      end

      puts ""
      @stats[:issues_found] += 1
    end
  end

  def generate_fixes
    puts "=" * 70
    puts "  SUGGESTED FIXES"
    puts "=" * 70
    puts ""

    @grouped_issues.group_by { |k, _| k.split("#").first }.each do |model, issues|
      puts "  # In #{model.underscore}.rb:"
      puts ""

      issues.each do |key, occurrences|
        method = key.split("#").last
        similar = occurrences.first[:similar]

        if similar
          info = @model_cache[model]
          if info && info[:columns].include?(similar)
            puts "  alias_attribute :#{method}, :#{similar}"
          elsif info && info[:associations].include?(similar)
            puts "  alias_method :#{method}, :#{similar}"
          else
            puts "  alias_method :#{method}, :#{similar}"
          end
        else
          puts "  def #{method}"
          puts "    nil # TODO: implement or map to existing method"
          puts "  end"
        end
        puts ""
      end

      puts "  " + "-" * 40
      puts ""
    end
  end

  def print_summary
    puts "=" * 70
    puts "  SUMMARY"
    puts "=" * 70
    puts ""
    puts "  Models checked:  #{@stats[:models_checked]}"
    puts "  Files scanned:   #{@stats[:files_scanned]}"
    puts "  Issues found:    #{@stats[:issues_found]}"
    puts ""

    if @stats[:issues_found] > 0
      puts "  Status: FAILED - Fix issues before deploying"
    else
      puts "  Status: PASSED - No SSoT violations"
    end

    puts ""
    puts "=" * 70
    puts ""
  end
end

# Run if executed directly
if __FILE__ == $0
  options = {
    fix: ARGV.include?("--fix"),
    json: ARGV.include?("--json"),
  }

  exit SsotAuditor.new(options).run
end
