# frozen_string_literal: true

require "csv"

module Importers
  # DatabuildBoqImportService - Import Databuild Bill of Quantities CSV into TEEEM
  #
  # Databuild exports BOQ data as CSV with cost centres, loads (subcontractor orders),
  # and line items. This service matches to existing TEEEM jobs by job_code and creates:
  # - CostCentres from Databuild cost centre codes (510, 511, 520, etc.)
  # - SmScheduleMaster templates from BOQ line items (linked to cost centres)
  # - PurchaseOrders from Databuild "Loads" (Load 1, Load 2, etc.)
  # - PurchaseOrderLineItems from Databuild line items within cost centres
  # - JobCostBudgets linking cost centres to jobs with budget amounts
  #
  # Expected CSV formats (auto-detected):
  #
  # 1. Cost Centre Summary:
  #    Code, Cost Centre, Bill Amount, Budget
  #    510, Landscaping, $0.00, $0.00
  #
  # 2. Load Summary:
  #    Load, Amount, Supplier, Order Date, Comments
  #    Load 1, $8427.46, Flooring Creations Pty Ltd, 4/08/2025
  #
  # 3. BOQ Detail (Bill of Quantities with cost centre sections):
  #    Item, Description, Quantity, Units, Rate, Amount, Lvl, Ld
  #    090-00000, Contract Allowances, 0, EACH, $0.00, $0.00, -1, 1
  #    10.0004, Allowance, 1, EACH, $100.00, $100.00, 0, 1
  #
  # 4. Line Item Detail:
  #    Code, Description, Quantity, Units, Unit Price, Price, Load
  #    520-0001, Supply and Install Floor Coverings, 1, Quote, $8427.46, $8427.46, 1
  #
  # Matching: Databuild job code (e.g., "11ASH") → TEEEM Job.job_code
  #
  class DatabuildBoqImportService
    attr_reader :stats

    def initialize(job)
      @job = job
      @stats = {
        cost_centres_created: 0,
        cost_centres_updated: 0,
        cost_centres_skipped: 0,
        purchase_orders_created: 0,
        purchase_orders_skipped: 0,
        line_items_created: 0,
        budgets_created: 0,
        budgets_updated: 0,
        sm_tasks_created: 0,
        sm_tasks_skipped: 0,
        errors: []
      }
    end

    # Preview what would be imported from a CSV (no database changes)
    def preview(csv_content)
      detected = detect_format(csv_content)

      case detected[:format]
      when :cost_centre_summary
        preview_cost_centres(detected[:rows])
      when :load_summary
        preview_loads(detected[:rows])
      when :boq_detail
        preview_boq(detected[:rows])
      when :line_item_detail
        preview_line_items(detected[:rows])
      else
        { success: false, error: "Unrecognized CSV format. Expected Databuild Cost Centre Summary, Load Summary, BOQ, or Line Item Detail export." }
      end
    rescue CSV::MalformedCSVError => e
      { success: false, error: "Invalid CSV: #{e.message}" }
    rescue StandardError => e
      { success: false, error: "Preview failed: #{e.message}" }
    end

    # Import cost centres from CSV
    def import_cost_centres(csv_content)
      detected = detect_format(csv_content)

      unless detected[:format] == :cost_centre_summary
        return { success: false, error: "Expected Cost Centre Summary CSV format" }
      end

      import_cost_centre_rows(detected[:rows])
    rescue StandardError => e
      Rails.logger.error("Databuild cost centre import failed: #{e.message}")
      { success: false, error: e.message, stats: @stats }
    end

    # Import loads as purchase orders from CSV
    def import_loads(csv_content)
      detected = detect_format(csv_content)

      unless detected[:format] == :load_summary
        return { success: false, error: "Expected Load Summary CSV format" }
      end

      import_load_rows(detected[:rows])
    rescue StandardError => e
      Rails.logger.error("Databuild load import failed: #{e.message}")
      { success: false, error: e.message, stats: @stats }
    end

    # Import line items from BOQ detail CSV
    def import_line_items(csv_content)
      detected = detect_format(csv_content)

      unless detected[:format] == :line_item_detail
        return { success: false, error: "Expected Line Item Detail CSV format" }
      end

      import_line_item_rows(detected[:rows])
    rescue StandardError => e
      Rails.logger.error("Databuild line item import failed: #{e.message}")
      { success: false, error: e.message, stats: @stats }
    end

    # Auto-detect and import any Databuild CSV format
    def import_auto(csv_content)
      detected = detect_format(csv_content)

      case detected[:format]
      when :cost_centre_summary
        import_cost_centre_rows(detected[:rows])
      when :load_summary
        import_load_rows(detected[:rows])
      when :boq_detail
        import_boq_rows(detected[:rows])
      when :line_item_detail
        import_line_item_rows(detected[:rows])
      else
        { success: false, error: "Unrecognized CSV format" }
      end
    rescue StandardError => e
      Rails.logger.error("Databuild import failed: #{e.message}")
      { success: false, error: e.message, stats: @stats }
    end

    # Class method: Find job by Databuild job code
    def self.find_job_by_code(job_code)
      return nil if job_code.blank?

      Job.find_by(job_code: job_code.strip.upcase) ||
        Job.find_by("UPPER(job_code) = ?", job_code.strip.upcase)
    end

    private

    # ============================================
    # FORMAT DETECTION
    # ============================================

    def detect_format(csv_content)
      # Handle encoding - Crystal Reports exports are often ISO-8859-1
      safe_content = if csv_content.encoding == Encoding::UTF_8 && !csv_content.valid_encoding?
        csv_content.encode("UTF-8", "ISO-8859-1", invalid: :replace, undef: :replace, replace: "")
      else
        csv_content.force_encoding("UTF-8")
      end
      safe_content = safe_content.encode("UTF-8", invalid: :replace, undef: :replace, replace: "")

      rows = CSV.parse(safe_content, headers: true, liberal_parsing: true)
      headers = rows.headers.map { |h| h.to_s.strip.downcase }

      # Detect Crystal Reports flat BOQ format (Databuild report export)
      # Signature: "bill of quantities" appears as a header value because the first row
      # is report metadata, not real column headers. Every row contains the full report
      # layout with literal "Item","Description",... labels followed by actual data.
      if headers.any? { |h| h&.include?("bill of quantities") }
        return detect_crystal_reports_boq(csv_content)
      end

      format = if cost_centre_headers?(headers)
        :cost_centre_summary
      elsif load_headers?(headers)
        :load_summary
      elsif boq_headers?(headers)
        :boq_detail
      elsif line_item_headers?(headers)
        :line_item_detail
      else
        :unknown
      end

      { format: format, rows: rows, headers: headers }
    end

    # Detect and normalize Crystal Reports flat BOQ export
    # These have NO header row - every row contains metadata + literal header labels + data:
    #   [page],[report type],[company],[date],[job label],[job code],[client],[address],
    #   [section name],"Item","Description","Quantity","Units","Rate","Amount","Lvl","Ld",
    #   [actual item],[actual desc],[actual qty],[actual units],[actual rate],[actual amount],[actual lvl],[actual ld],
    #   [comments],[section total label],[section total],[footer...]
    def detect_crystal_reports_boq(csv_content)
      # Force encoding to handle Crystal Reports exports (often ISO-8859-1)
      safe_content = csv_content.encode("UTF-8", "ISO-8859-1", invalid: :replace, undef: :replace, replace: "")
      raw_rows = CSV.parse(safe_content, liberal_parsing: true)
      return { format: :unknown, rows: [], headers: [] } if raw_rows.empty?

      first_row = raw_rows.first

      # Find the marker sequence: "Item","Description","Quantity" in the row
      marker_start = nil
      first_row.each_with_index do |val, idx|
        if val&.strip == "Item" &&
           first_row[idx + 1]&.strip == "Description" &&
           first_row[idx + 2]&.strip == "Quantity"
          marker_start = idx
          break
        end
      end

      return { format: :unknown, rows: [], headers: [] } unless marker_start

      # Data columns start 8 positions after the markers (Item,Description,Quantity,Units,Rate,Amount,Lvl,Ld)
      data_start = marker_start + 8
      # Cost centre section label is just before the marker columns
      section_col = marker_start - 1

      normalized = raw_rows.filter_map do |row|
        next nil if row.length < data_start + 8

        {
          "Item" => row[data_start]&.to_s&.strip,
          "Description" => row[data_start + 1]&.to_s&.strip,
          "Quantity" => row[data_start + 2]&.to_s&.strip,
          "Units" => row[data_start + 3]&.to_s&.strip,
          "Rate" => row[data_start + 4]&.to_s&.strip,
          "Amount" => row[data_start + 5]&.to_s&.strip,
          "Lvl" => row[data_start + 6]&.to_s&.strip,
          "Ld" => row[data_start + 7]&.to_s&.strip,
          "Section" => row[section_col]&.to_s&.strip
        }
      end

      headers = %w[item description quantity units rate amount lvl ld section]
      { format: :boq_detail, rows: normalized, headers: headers }
    end

    def cost_centre_headers?(headers)
      # "Code", "Cost Centre", "Bill Amount" or "Budget"
      has_code = headers.any? { |h| h == "code" }
      has_cost_centre = headers.any? { |h| h.include?("cost centre") || h.include?("cost center") }
      has_amount = headers.any? { |h| h.include?("bill amount") || h.include?("budget") }
      has_code && has_cost_centre && has_amount
    end

    def load_headers?(headers)
      # "Load", "Amount", "Supplier"
      has_load = headers.any? { |h| h == "load" }
      has_amount = headers.any? { |h| h == "amount" }
      has_supplier = headers.any? { |h| h == "supplier" }
      has_load && has_amount && has_supplier
    end

    def boq_headers?(headers)
      # BOQ = line item headers PLUS a level column (Lvl/Level)
      # Databuild BOQ exports include Lvl column for section hierarchy
      has_level = headers.any? { |h| h == "lvl" || h == "level" }
      has_level && line_item_headers?(headers)
    end

    def line_item_headers?(headers)
      # "Code"/"Item", "Description", "Quantity", "Unit Price"/"Price"/"Rate"
      # Databuild BOQ exports use "Item" instead of "Code", and "Rate"/"Amount" instead of "Price"
      has_code = headers.any? { |h| h == "code" || h == "item" }
      has_description = headers.any? { |h| h == "description" }
      has_quantity = headers.any? { |h| h == "quantity" || h == "qty" }
      has_price = headers.any? { |h| h.include?("price") || h == "rate" || h == "amount" }
      has_code && has_description && has_quantity && has_price
    end

    # ============================================
    # COST CENTRE IMPORT
    # ============================================

    def preview_cost_centres(rows)
      items = rows.map do |row|
        code = row["Code"]&.strip
        name = find_header_value(row, ["Cost Centre", "Cost Center", "Description"])
        bill_amount = parse_money(find_header_value(row, ["Bill Amount"]))
        budget = parse_money(find_header_value(row, ["Budget"]))

        next if code.blank?

        existing = CostCentre.find_by(code: code)

        {
          code: code,
          name: name,
          bill_amount: bill_amount,
          budget: budget,
          status: existing ? "exists" : "new"
        }
      end.compact

      {
        success: true,
        format: "cost_centre_summary",
        job: { id: @job.id, name: @job.name, job_code: @job.job_code },
        items: items,
        summary: {
          total: items.length,
          new: items.count { |i| i[:status] == "new" },
          existing: items.count { |i| i[:status] == "exists" },
          total_bill_amount: items.sum { |i| i[:bill_amount] || 0 },
          total_budget: items.sum { |i| i[:budget] || 0 }
        }
      }
    end

    def import_cost_centre_rows(rows)
      ActiveRecord::Base.transaction do
        rows.each do |row|
          code = row["Code"]&.strip
          name = find_header_value(row, ["Cost Centre", "Cost Center", "Description"])
          bill_amount = parse_money(find_header_value(row, ["Bill Amount"]))
          budget = parse_money(find_header_value(row, ["Budget"]))

          next if code.blank?

          # Find or create cost centre
          cost_centre = CostCentre.find_by(code: code)
          if cost_centre
            @stats[:cost_centres_skipped] += 1
          else
            cost_centre = CostCentre.create!(
              code: code,
              name: name.presence || "Cost Centre #{code}",
              centre_type: "project",
              budget_amount: bill_amount || budget,
              active: true
            )
            @stats[:cost_centres_created] += 1
          end

          # Create JobCostBudget linking this cost centre to the job
          existing_budget = JobCostBudget.find_by(job: @job, cost_centre: cost_centre)
          unless existing_budget
            JobCostBudget.create!(
              job: @job,
              cost_centre: cost_centre,
              total_budget: bill_amount || budget || 0,
              materials_budget: bill_amount || budget || 0
            )
            @stats[:budgets_created] += 1
          end
        rescue StandardError => e
          @stats[:errors] << "Cost centre '#{code}': #{e.message}"
        end
      end

      { success: true, stats: @stats }
    end

    # ============================================
    # LOAD (PURCHASE ORDER) IMPORT
    # ============================================

    def preview_loads(rows)
      items = rows.map do |row|
        load_name = row["Load"]&.strip
        amount = parse_money(row["Amount"])
        supplier = row["Supplier"]&.strip
        order_date = row["Order Date"]&.strip
        comments = find_header_value(row, ["Comments", "Comment", "OvRun", "Description"])

        next if load_name.blank? || amount.nil? || amount.zero?

        # Extract load number for PO number generation
        load_num = load_name.gsub(/\D/, "")
        po_number = "#{@job.job_code}-L#{load_num}"

        existing_po = @job.purchase_orders.find_by(purchase_order_number: po_number)

        {
          load_name: load_name,
          po_number: po_number,
          amount: amount,
          supplier: supplier,
          order_date: order_date,
          comments: comments,
          status: existing_po ? "exists" : "new"
        }
      end.compact

      {
        success: true,
        format: "load_summary",
        job: { id: @job.id, name: @job.name, job_code: @job.job_code },
        items: items,
        summary: {
          total: items.length,
          new: items.count { |i| i[:status] == "new" },
          existing: items.count { |i| i[:status] == "exists" },
          total_amount: items.sum { |i| i[:amount] || 0 }
        }
      }
    end

    def import_load_rows(rows)
      ActiveRecord::Base.transaction do
        rows.each do |row|
          load_name = row["Load"]&.strip
          amount = parse_money(row["Amount"])
          supplier_name = row["Supplier"]&.strip
          order_date_str = row["Order Date"]&.strip
          comments = find_header_value(row, ["Comments", "Comment", "OvRun", "Description"])

          next if load_name.blank? || amount.nil? || amount.zero?

          load_num = load_name.gsub(/\D/, "")
          po_number = "#{@job.job_code}-L#{load_num}"

          # Skip if PO already exists
          existing_po = @job.purchase_orders.find_by(purchase_order_number: po_number)
          if existing_po
            @stats[:purchase_orders_skipped] += 1
            next
          end

          # Find supplier contact
          supplier = find_supplier(supplier_name)

          # Parse date (DD/MM/YYYY Australian format)
          ordered_date = parse_au_date(order_date_str)

          @job.purchase_orders.create!(
            purchase_order_number: po_number,
            supplier: supplier,
            description: "#{load_name} - #{supplier_name}".truncate(500),
            total: amount,
            sub_total: (amount / 1.1).round(2), # Assume 10% GST
            tax: (amount - (amount / 1.1)).round(2),
            status: ordered_date.present? ? "ordered" : "draft",
            ordered_date: ordered_date,
            special_instructions: comments
          )
          @stats[:purchase_orders_created] += 1
        rescue StandardError => e
          @stats[:errors] << "Load '#{load_name}': #{e.message}"
        end
      end

      { success: true, stats: @stats }
    end

    # ============================================
    # LINE ITEM IMPORT
    # ============================================

    def preview_line_items(rows)
      items = rows.map do |row|
        code = find_header_value(row, ["Code", "Item"])
        description = row["Description"]&.strip
        quantity = (find_header_value(row, ["Quantity", "Qty"]))&.to_f || 0
        unit = find_header_value(row, ["Units", "Unit", "UOM"])
        unit_price = parse_money(find_header_value(row, ["Unit Price", "Rate"]))
        total_price = parse_money(find_header_value(row, ["Price", "Amount", "Total"]))
        load_num = find_header_value(row, ["Load", "Ld"])
        level = find_header_value(row, ["Lvl", "Level"])&.to_i

        next if code.blank? || description.blank?
        # Skip section headers (Lvl -1) and zero-value header rows from BOQ exports
        next if level.present? && level < 0

        {
          code: code,
          description: description,
          quantity: quantity,
          unit: unit,
          unit_price: unit_price,
          total_price: total_price,
          load: load_num
        }
      end.compact

      {
        success: true,
        format: "line_item_detail",
        job: { id: @job.id, name: @job.name, job_code: @job.job_code },
        items: items,
        summary: {
          total: items.length,
          total_amount: items.sum { |i| i[:total_price] || 0 }
        }
      }
    end

    def import_line_item_rows(rows)
      # Group line items by load number to add to correct PO
      by_load = {}

      rows.each do |row|
        code = find_header_value(row, ["Code", "Item"])
        description = row["Description"]&.strip
        quantity = (find_header_value(row, ["Quantity", "Qty"]))&.to_f || 1
        unit_price = parse_money(find_header_value(row, ["Unit Price", "Rate"])) || 0
        total_price = parse_money(find_header_value(row, ["Price", "Amount", "Total"])) || 0
        load_num = find_header_value(row, ["Load", "Ld"])
        level = find_header_value(row, ["Lvl", "Level"])&.to_i

        next if code.blank? || description.blank?
        # Skip section headers (Lvl -1) from BOQ exports
        next if level.present? && level < 0
        next if load_num.blank?

        by_load[load_num] ||= []
        by_load[load_num] << {
          code: code,
          description: description,
          quantity: quantity,
          unit_price: unit_price,
          total_price: total_price
        }
      end

      ActiveRecord::Base.transaction do
        by_load.each do |load_num, items|
          po_number = "#{@job.job_code}-L#{load_num}"
          po = @job.purchase_orders.find_by(purchase_order_number: po_number)

          unless po
            @stats[:errors] << "No PO found for Load #{load_num} (#{po_number}). Import loads first."
            next
          end

          items.each_with_index do |item, idx|
            PurchaseOrderLineItem.create!(
              purchase_order: po,
              description: "#{item[:code]} - #{item[:description]}",
              quantity: item[:quantity],
              unit_price: item[:unit_price],
              total_amount: item[:total_price],
              line_number: idx + 1
            )
            @stats[:line_items_created] += 1
          rescue StandardError => e
            @stats[:errors] << "Line item '#{item[:code]}': #{e.message}"
          end
        end
      end

      { success: true, stats: @stats }
    end

    # ============================================
    # BOQ (BILL OF QUANTITIES) IMPORT
    # ============================================
    # BOQ exports contain cost centre sections (Lvl -1) and line items (Lvl >= 0).
    # Creates CostCentre records from sections and SmScheduleMaster templates
    # from line items, linked to their parent cost centre.

    def preview_boq(rows)
      sections = parse_boq_sections(rows)

      cost_centres = sections.map do |section|
        existing = CostCentre.find_by(code: section[:code])
        {
          code: section[:code],
          name: section[:name],
          item_count: section[:items].length,
          total_amount: section[:items].sum { |i| i[:total_price] || 0 },
          status: existing ? "exists" : "new"
        }
      end

      items = sections.flat_map do |section|
        section[:items].map do |item|
          item.merge(cost_centre_code: section[:code], cost_centre_name: section[:name])
        end
      end

      {
        success: true,
        format: "boq_detail",
        job: { id: @job.id, name: @job.name, job_code: @job.job_code },
        cost_centres: cost_centres,
        items: items,
        summary: {
          total_cost_centres: cost_centres.length,
          new_cost_centres: cost_centres.count { |c| c[:status] == "new" },
          existing_cost_centres: cost_centres.count { |c| c[:status] == "exists" },
          total_items: items.length,
          total_amount: items.sum { |i| i[:total_price] || 0 }
        }
      }
    end

    def import_boq_rows(rows)
      sections = parse_boq_sections(rows)

      ActiveRecord::Base.transaction do
        sections.each do |section|
          # 1. Create or find CostCentre from section header
          cost_centre = CostCentre.find_by(code: section[:code])
          if cost_centre
            @stats[:cost_centres_skipped] += 1
          else
            cost_centre = CostCentre.create!(
              code: section[:code],
              name: section[:name].presence || "Cost Centre #{section[:code]}",
              centre_type: "project",
              budget_amount: section[:items].sum { |i| i[:total_price] || 0 },
              active: true
            )
            @stats[:cost_centres_created] += 1
          end

          # 2. Create SmScheduleMaster templates for each line item
          section[:items].each do |item|
            # Dedup by name + cost_centre to avoid duplicates on re-import
            existing = SmScheduleMaster.find_by(name: item[:description], cost_centre: cost_centre.id)
            if existing
              @stats[:sm_tasks_skipped] += 1
              next
            end

            has_load = item[:load].present? && item[:load].to_s.strip != "0"
            load_num = item[:load].to_s.strip if has_load

            SmScheduleMaster.create!(
              name: item[:description],
              description: "#{item[:code]} - Qty: #{item[:quantity]} #{item[:unit]} @ #{item[:unit_price]}",
              duration_days: 1,
              cost_centre: cost_centre.id,
              po_required: has_load,
              po_line_items: has_load ? {
                load_number: load_num.to_i,
                code: item[:code],
                quantity: item[:quantity],
                unit: item[:unit],
                unit_price: item[:unit_price],
                total_price: item[:total_price]
              } : nil,
              sm_template_ids: [],
              predecessor_ids: []
            )
            @stats[:sm_tasks_created] += 1
          rescue StandardError => e
            @stats[:errors] << "SM Task '#{item[:code]}': #{e.message}"
          end

          # 3. Create JobCostBudget linking cost centre to job
          existing_budget = JobCostBudget.find_by(job: @job, cost_centre: cost_centre)
          unless existing_budget
            section_total = section[:items].sum { |i| i[:total_price] || 0 }
            if section_total > 0
              JobCostBudget.create!(
                job: @job,
                cost_centre: cost_centre,
                total_budget: section_total,
                materials_budget: section_total
              )
              @stats[:budgets_created] += 1
            end
          end
        rescue StandardError => e
          @stats[:errors] << "Section '#{section[:code]}': #{e.message}"
        end
      end

      { success: true, stats: @stats }
    end

    # Parse BOQ rows into sections grouped by cost centre
    # Handles two formats:
    # 1. Crystal Reports (has "Section" key): group by Section column value
    # 2. Standard BOQ (has Lvl column): group by Lvl -1 section headers
    def parse_boq_sections(rows)
      sections = []
      current_section = nil
      last_section_label = nil

      rows.each do |row|
        level_val = find_header_value(row, ["Lvl", "Level"])
        level = level_val.present? ? level_val.to_i : nil
        code = find_header_value(row, ["Code", "Item"])
        description = row["Description"]&.strip
        section_label = row["Section"]&.to_s&.strip.presence  # Crystal Reports format

        next if code.blank? && description.blank?

        # Detect new section
        new_section = false
        cc_code = nil
        cc_name = nil

        if section_label.present? && section_label != last_section_label
          # Crystal Reports format: section change detected from Section column
          # e.g., "102  Engineering - Design & Inspectio" → code "102"
          cc_code = extract_section_code(section_label)
          cc_name = section_label.sub(/^\d+\s*/, "").strip
          new_section = true if cc_code.present?
          last_section_label = section_label
        elsif section_label.blank? && level.present? && level < 0
          # Standard BOQ format: section header from Lvl -1
          cc_code = extract_cost_centre_code(code)
          cc_name = description
          new_section = true if cc_code.present?
        end

        if new_section && cc_code.present?
          current_section = {
            code: cc_code,
            name: cc_name.presence || "Cost Centre #{cc_code}",
            raw_code: code,
            items: []
          }
          sections << current_section
          # If Lvl -1, this row is just a section header - skip adding as line item
          next if level.present? && level < 0
        end

        # Skip section header rows (Lvl -1) that didn't create a new section
        next if level.present? && level < 0

        # Add line item to current section
        next unless current_section && code.present? && description.present?

        quantity = (find_header_value(row, ["Quantity", "Qty"]))&.to_f || 0
        unit_price = parse_money(find_header_value(row, ["Unit Price", "Rate"])) || 0
        total_price = parse_money(find_header_value(row, ["Price", "Amount", "Total"])) || 0

        # Skip zero-value items (likely totals or empty rows)
        next if quantity.zero? && total_price.zero?

        current_section[:items] << {
          code: code,
          description: description,
          quantity: quantity,
          unit: find_header_value(row, ["Units", "Unit", "UOM"]),
          unit_price: unit_price,
          total_price: total_price,
          load: find_header_value(row, ["Load", "Ld"])
        }
      end

      sections
    end

    # Extract cost centre code from Section column label
    # "102  Engineering - Design & Inspectio" → "102"
    # "90  Contract Allowances" → "90"
    def extract_section_code(section_label)
      return nil if section_label.blank?
      match = section_label.match(/^(\d+)/)
      match ? match[1] : nil
    end

    # Extract cost centre code from Databuild item code
    # "090-00000" → "90", "510-00000" → "510"
    def extract_cost_centre_code(raw_code)
      return nil if raw_code.blank?

      # Take segment before dash (e.g., "090" from "090-00000")
      code = raw_code.split("-").first&.strip
      return nil if code.blank?

      # Strip leading zeros but keep at least one digit
      code.gsub(/^0+(?=\d)/, "")
    end

    # ============================================
    # HELPERS
    # ============================================

    def find_header_value(row, possible_headers)
      possible_headers.each do |header|
        val = row[header]
        return val&.strip if val.present?
      end
      nil
    end

    def parse_money(value)
      return nil if value.blank?
      value.to_s.gsub(/[^\d.\-]/, "").to_f.round(2)
    end

    def parse_au_date(date_str)
      return nil if date_str.blank?

      # Try DD/MM/YYYY (Australian format)
      if date_str.match?(%r{\A\d{1,2}/\d{1,2}/\d{4}\z})
        Date.strptime(date_str, "%d/%m/%Y")
      elsif date_str.match?(%r{\A\d{1,2}/\d{1,2}/\d{2}\z})
        Date.strptime(date_str, "%d/%m/%y")
      else
        Date.parse(date_str)
      end
    rescue Date::Error
      nil
    end

    def find_supplier(supplier_name)
      return nil if supplier_name.blank?

      # Try exact match first
      contact = Contact.find_by("LOWER(display_name) = ?", supplier_name.downcase)
      return contact if contact

      # Try fuzzy match on company name
      Contact.where("LOWER(display_name) LIKE ?", "%#{supplier_name.downcase}%").first
    end
  end
end
