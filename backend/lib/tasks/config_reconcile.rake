# frozen_string_literal: true

# Config Sync Reconciliation rake tasks
#
# Usage:
#   MODE=verify rails config_sync:reconcile                              # Quick check all tables
#   MODE=report rails config_sync:reconcile                              # Detailed report
#   MODE=fix rails config_sync:reconcile                                 # Fix everything
#   MODE=verify TABLE=sm_schedule_masters rails config_sync:reconcile    # Check one table
#   MODE=fix TABLE=sm_schedule_masters rails config_sync:reconcile       # Fix one table

namespace :config_sync do
  desc "Reconcile config sync across all tenants (MODE=verify|report|fix, TABLE=table_key|all)"
  task reconcile: :environment do
    mode = ENV.fetch("MODE", "verify")
    table = ENV.fetch("TABLE", "all")

    unless %w[verify report fix].include?(mode)
      puts "ERROR: Invalid MODE=#{mode}. Must be verify, report, or fix"
      exit 1
    end

    puts "=" * 70
    puts "Config Sync Reconciliation"
    puts "  Mode:  #{mode.upcase}"
    puts "  Table: #{table}"
    puts "=" * 70
    puts

    reconciler = ConfigSyncReconciler.new
    start_time = Time.current

    case mode
    when "verify"
      result = reconciler.verify(table)
      print_verify(result)

    when "report"
      result = reconciler.report(table)
      print_report(result)

    when "fix"
      puts "Fixing #{table == 'all' ? 'ALL tables' : table}..."
      puts
      result = reconciler.fix(table)
      print_fix(result)
    end

    elapsed = (Time.current - start_time).round(1)
    puts
    puts "Completed in #{elapsed}s"
  end
end

def print_verify(result)
  overall = result[:pass] ? "\e[32mPASS\e[0m" : "\e[31mFAIL\e[0m"
  puts "Overall: #{overall}"
  puts

  result[:tables].each do |key, data|
    status_color = data[:status] == "pass" ? "\e[32m" : "\e[31m"
    counts = data[:counts].map { |t, c| "#{t}: #{c}" }.join(", ")
    puts "  #{status_color}#{data[:status].upcase}\e[0m  #{key}"
    puts "        Counts: #{counts}"
    if data[:issues]
      data[:issues].each { |issue| puts "        \e[33m! #{issue}\e[0m" }
    end
  end
end

def print_report(result)
  result[:tables].each do |key, data|
    status_color = data[:status] == "pass" ? "\e[32m" : "\e[31m"
    puts "#{status_color}#{data[:status].upcase}\e[0m  #{key} (master: #{data[:master_count]})"
    puts "      \e[33m! Master has #{data[:master_no_sync_key]} records without sync_key\e[0m" if data[:master_no_sync_key]

    data[:tenants].each do |tenant_name, td|
      puts "      #{tenant_name} (#{td[:count]} records)"

      if td[:missing]
        puts "        \e[31mMissing #{td[:missing].size}:\e[0m"
        td[:missing].each { |m| puts "          - #{m[:name]} (#{m[:sync_key]})" }
      end

      if td[:extra]
        puts "        \e[33mExtra #{td[:extra].size}:\e[0m"
        td[:extra].each { |e| puts "          - #{e[:name]} (#{e[:sync_key]})" }
      end

      if td[:diffs]
        puts "        \e[36mDiffs #{td[:diffs].size}:\e[0m"
        td[:diffs].each do |d|
          puts "          #{d[:name]} (#{d[:sync_key]}):"
          d[:fields].each do |f|
            puts "            #{f[:field]}: #{f[:master]} → #{f[:customer]}"
          end
        end
      end

      if td[:duplicates]
        puts "        \e[31mDuplicates #{td[:duplicates].size}:\e[0m"
        td[:duplicates].each { |d| puts "          #{d[:sync_key]} (#{d[:count]}x, ids: #{d[:ids].join(', ')})" }
      end

      puts "        \e[33m#{td[:no_sync_key]} records without sync_key\e[0m" if td[:no_sync_key]
    end
    puts
  end
end

def print_fix(result)
  if result[:phases].any?
    puts "Fix phases:"
    result[:phases].each do |key, phases|
      puts "  #{key}:"
      phases.each do |phase_name, phase_data|
        puts "    #{phase_name}:"
        if phase_data.is_a?(Hash)
          phase_data.each do |tenant, val|
            puts "      #{tenant}: #{val.is_a?(Hash) ? val.map { |k, v| "#{k}=#{v}" }.join(', ') : val}"
          end
        end
      end
    end
    puts
  else
    puts "No fixes needed."
    puts
  end

  puts "Post-fix verification:"
  print_verify(result[:verification])
end
