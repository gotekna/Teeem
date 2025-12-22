# frozen_string_literal: true

namespace :schedule_master do
  desc "Import Schedule Master from Excel file"
  task :import, [:file_path, :template_id] => :environment do |_t, args|
    require "roo"

    file_path = args[:file_path] || Rails.root.join("..", "Schedule_MAster rob.xlsx")
    template_id = args[:template_id]&.to_i || 7

    unless File.exist?(file_path)
      puts "File not found: #{file_path}"
      exit 1
    end

    template = SmTemplate.find_by(id: template_id)
    unless template
      puts "Template not found: #{template_id}"
      exit 1
    end

    puts "=== SCHEDULE MASTER IMPORT ==="
    puts "File: #{file_path}"
    puts "Template: #{template.id} - #{template.name}"
    puts

    xlsx = Roo::Excelx.new(file_path.to_s)
    headers = xlsx.row(1)

    # Column index mapping
    col_map = {
      task_name: headers.index("Task Name"),
      predecessors: headers.index("Predecessors"),
      duration: headers.index("Duration"),
      po_required: headers.index("PO Required"),
      auto_po: headers.index("Auto PO"),
      critical: headers.index("Critical"),
      photo: headers.index("Photo"),
      cert: headers.index("Cert"),
      cert_lag: headers.index("Cert Lag"),
      manual: headers.index("Manual"),
      multi: headers.index("Multi")
    }

    puts "Column mapping:"
    col_map.each { |k, v| puts "  #{k}: column #{v}" if v }
    puts

    updated = 0
    errors = []

    (2..xlsx.last_row).each do |row_num|
      row = xlsx.row(row_num)
      task_name = row[col_map[:task_name]]
      next if task_name.blank?

      # Find existing row by task_number (1-indexed from Excel row)
      task_number = row_num - 1
      template_row = template.sm_template_rows.find_by(task_number: task_number)

      unless template_row
        errors << "Row #{row_num}: Task #{task_number} '#{task_name}' not found in template"
        next
      end

      # Parse values
      attrs = {}

      # Boolean fields (Yes/No)
      attrs[:po_required] = parse_yes_no(row[col_map[:po_required]]) if col_map[:po_required]
      attrs[:critical_po] = parse_yes_no(row[col_map[:critical]]) if col_map[:critical]
      attrs[:require_photo] = parse_yes_no(row[col_map[:photo]]) if col_map[:photo]
      attrs[:require_certificate] = parse_yes_no(row[col_map[:cert]]) if col_map[:cert]
      attrs[:auto_include] = !parse_yes_no(row[col_map[:manual]]) if col_map[:manual] # Inverted!
      attrs[:allow_duplicates] = parse_yes_no(row[col_map[:multi]]) if col_map[:multi]

      # Numeric fields
      if col_map[:cert_lag] && row[col_map[:cert_lag]].present?
        attrs[:cert_lag_days] = row[col_map[:cert_lag]].to_i
      end

      # Duration (parse "5d" -> 5)
      if col_map[:duration] && row[col_map[:duration]].present?
        duration_str = row[col_map[:duration]].to_s
        if duration_str =~ /(\d+)d?/
          attrs[:duration_days] = $1.to_i
        end
      end

      # Predecessors (parse "1", "3, 4", "28FS +10d")
      if col_map[:predecessors] && row[col_map[:predecessors]].present?
        attrs[:predecessor_ids] = parse_predecessors(row[col_map[:predecessors]])
      end

      # Only update if we have values
      attrs.compact!
      attrs.reject! { |_k, v| v.nil? }

      if attrs.any?
        if template_row.update(attrs)
          updated += 1
          puts "Updated #{task_number}. #{task_name}"
        else
          errors << "Row #{row_num}: #{template_row.errors.full_messages.join(', ')}"
        end
      end
    end

    puts
    puts "=== IMPORT COMPLETE ==="
    puts "Updated: #{updated} rows"
    puts "Errors: #{errors.count}"
    errors.each { |e| puts "  - #{e}" } if errors.any?
  end

  desc "Show Schedule Master template summary"
  task :summary, [:template_id] => :environment do |_t, args|
    template_id = args[:template_id]&.to_i || 7
    template = SmTemplate.find_by(id: template_id)

    unless template
      puts "Template not found: #{template_id}"
      exit 1
    end

    puts "=== SCHEDULE MASTER SUMMARY ==="
    puts "Template: #{template.id} - #{template.name}"
    puts "Total rows: #{template.sm_template_rows.count}"
    puts
    puts "PO Required: #{template.sm_template_rows.where(po_required: true).count}"
    puts "Auto PO: #{template.sm_template_rows.where(create_po_on_job_start: true).count}"
    puts "Critical: #{template.sm_template_rows.where(critical_po: true).count}"
    puts "Photo Required: #{template.sm_template_rows.where(require_photo: true).count}"
    puts "Cert Required: #{template.sm_template_rows.where(require_certificate: true).count}"
    puts "Manual Only: #{template.sm_template_rows.where(auto_include: false).count}"
    puts "Allow Duplicates: #{template.sm_template_rows.where(allow_duplicates: true).count}"
    puts
    puts "With Plan Types: #{template.sm_template_rows.where("jsonb_array_length(plan_type_ids) > 0").count}"
    puts "With Start Docs: #{template.sm_template_rows.where("jsonb_array_length(start_entity_tab_ids) > 0").count}"
    puts "With Complete Docs: #{template.sm_template_rows.where("jsonb_array_length(complete_entity_tab_ids) > 0").count}"
  end

  private

  def parse_yes_no(value)
    return nil if value.blank?
    value.to_s.strip.downcase == "yes"
  end

  def parse_predecessors(value)
    return [] if value.blank?

    value.to_s.split(",").map do |pred|
      pred = pred.strip
      # Parse formats: "1", "3", "28FS +10d", "42SS -1d"
      match = pred.match(/(\d+)(FS|SS|FF|SF)?(\s*[+-]\s*\d+)?d?/i)
      next nil unless match

      id = match[1].to_i
      dep_type = (match[2] || "FS").upcase
      lag = match[3] ? match[3].gsub(/\s/, "").to_i : 0

      { "id" => id, "type" => dep_type, "lag" => lag }
    end.compact
  end
end
