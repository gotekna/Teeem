# frozen_string_literal: true

require "csv"

module Importers
  # DatabuildBoqImportService - Import Databuild Bill of Quantities CSV into TEEEM
  #
  # Databuild exports BOQ data as CSV with cost centres, loads (subcontractor orders),
  # and line items. This service matches to existing TEEEM jobs by job_code and creates:
  # - CostCentres from Databuild cost centre codes (510, 511, 520, etc.)
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
  # 3. Line Item Detail (BOQ export):
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
        cost_centres_skipped: 0,
        purchase_orders_created: 0,
        purchase_orders_skipped: 0,
        line_items_created: 0,
        budgets_created: 0,
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
      when :line_item_detail
        preview_line_items(detected[:rows])
      else
        { success: false, error: "Unrecognized CSV format. Expected Databuild Cost Centre Summary, Load Summary, or Line Item Detail export." }
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
      rows = CSV.parse(csv_content, headers: true, liberal_parsing: true)
      headers = rows.headers.map { |h| h.to_s.strip.downcase }

      format = if cost_centre_headers?(headers)
        :cost_centre_summary
      elsif load_headers?(headers)
        :load_summary
      elsif line_item_headers?(headers)
        :line_item_detail
      else
        :unknown
      end

      { format: format, rows: rows, headers: headers }
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

    def line_item_headers?(headers)
      # "Code", "Description", "Quantity", "Unit Price" or "Price"
      has_code = headers.any? { |h| h == "code" }
      has_description = headers.any? { |h| h == "description" }
      has_quantity = headers.any? { |h| h == "quantity" || h == "qty" }
      has_price = headers.any? { |h| h.include?("price") || h == "rate" }
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
        code = row["Code"]&.strip
        description = row["Description"]&.strip
        quantity = row["Quantity"]&.to_f || row["Qty"]&.to_f
        unit = find_header_value(row, ["Units", "Unit", "UOM"])
        unit_price = parse_money(find_header_value(row, ["Unit Price", "Rate"]))
        total_price = parse_money(find_header_value(row, ["Price", "Amount", "Total"]))
        load_num = row["Load"]&.strip

        next if code.blank? || description.blank?

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
        code = row["Code"]&.strip
        description = row["Description"]&.strip
        quantity = (row["Quantity"] || row["Qty"])&.to_f || 1
        unit_price = parse_money(find_header_value(row, ["Unit Price", "Rate"])) || 0
        total_price = parse_money(find_header_value(row, ["Price", "Amount", "Total"])) || 0
        load_num = row["Load"]&.strip

        next if code.blank? || description.blank?
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
