# frozen_string_literal: true

require "hexapdf"

# Generates a PDF bank statement report from Xero bank feed data.
# Format matches standard bank statement layout with running balance.
# Compliant with ATO record-keeping requirements per s262A ITAA 1936.
class BankTransactionReportService
  # Colors matching bank statement style (maroon/purple theme)
  HEADER_BG_COLOR = "5D2E46"      # Dark maroon for header bars
  HEADER_TEXT_COLOR = "FFFFFF"   # White text on headers
  BORDER_COLOR = "CCCCCC"        # Light gray borders
  DEBIT_COLOR = "000000"         # Black for debits
  CREDIT_COLOR = "000000"        # Black for credits

  LEGAL_DISCLAIMER = "This document is a transaction record reconstructed from Xero accounting software bank feed data. " \
                     "It is not an official bank statement. Retained as an accounting record per s262A ITAA 1936."

  def initialize(bank_account_id: nil, financial_year: nil, month: nil, start_date: nil, end_date: nil, opening_balance: nil)
    @bank_account_id = bank_account_id
    @financial_year = financial_year
    @month = month
    @start_date = start_date
    @end_date = end_date
    @opening_balance = opening_balance || BigDecimal("0")
  end

  def generate
    transactions = fetch_transactions
    return { success: false, error: "No transactions found" } if transactions.empty?

    pdf_content = build_pdf(transactions)

    {
      success: true,
      pdf: pdf_content,
      filename: generate_filename,
      transaction_count: transactions.count,
      period: period_description
    }
  rescue StandardError => e
    Rails.logger.error("BankTransactionReportService error: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    { success: false, error: e.message }
  end

  private

  def fetch_transactions
    scope = WarehouseBankTransaction.order(transaction_date: :asc, created_at: :asc)

    scope = scope.where(bank_account_id: @bank_account_id) if @bank_account_id.present?
    scope = scope.where(financial_year: @financial_year) if @financial_year.present?
    scope = scope.where(transaction_month: @month) if @month.present?
    scope = scope.where("transaction_date >= ?", @start_date) if @start_date.present?
    scope = scope.where("transaction_date <= ?", @end_date) if @end_date.present?

    scope.to_a
  end

  def build_pdf(transactions)
    doc = HexaPDF::Document.new

    # Get account info
    bank_account_name = transactions.first&.bank_account_name || "Unknown Account"
    bank_code = transactions.first&.bank_account_code || ""

    # Calculate period
    first_date = transactions.map(&:transaction_date).min
    last_date = transactions.map(&:transaction_date).max

    # Calculate totals with running balance
    total_debits = BigDecimal("0")
    total_credits = BigDecimal("0")
    running_balance = @opening_balance

    transactions_with_balance = transactions.map do |txn|
      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "RECEIVE"
        total_credits += amount
        running_balance += amount
      else
        total_debits += amount
        running_balance -= amount
      end
      { txn: txn, balance: running_balance.dup }
    end

    closing_balance = running_balance

    # Generate pages (max ~30 transactions per page to leave room)
    transactions_per_page = 28
    pages_data = transactions_with_balance.each_slice(transactions_per_page).to_a
    total_pages = pages_data.length

    pages_data.each_with_index do |page_transactions, page_idx|
      page = doc.pages.add(:A4)
      canvas = page.canvas

      is_first_page = page_idx == 0
      is_last_page = page_idx == total_pages - 1

      # Draw statement content
      draw_statement_header(canvas, bank_account_name, bank_code, first_date, last_date, page_idx + 1, total_pages)

      # Summary box (only on first page)
      if is_first_page
        draw_summary_box(canvas, total_debits, total_credits, closing_balance)
      end

      # Transactions table
      y_start = is_first_page ? 620 : 720
      draw_transactions_section(canvas, page_transactions, y_start, is_first_page, is_last_page)

      # Footer
      draw_footer(canvas, page_idx + 1, total_pages)
    end

    # Output to string
    output = StringIO.new
    doc.write(output)
    output.string
  end

  def draw_statement_header(canvas, account_name, account_code, start_date, end_date, page_num, total_pages)
    # Top maroon header bar
    canvas.fill_color(HEADER_BG_COLOR)
    canvas.rectangle(0, 790, 595, 52)
    canvas.fill

    # Bank name / title in header
    canvas.fill_color(HEADER_TEXT_COLOR)
    canvas.font("Helvetica", size: 20, variant: :bold)
    canvas.text("BANK STATEMENT", at: [50, 810])

    canvas.font("Helvetica", size: 10)
    canvas.text("Page #{page_num} of #{total_pages}", at: [480, 810])

    # Reset to black
    canvas.fill_color("000000")

    # Account details section
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Account:", at: [50, 760])
    canvas.font("Helvetica", size: 10)
    canvas.text(account_name, at: [110, 760])

    if account_code.present?
      canvas.font("Helvetica", size: 10, variant: :bold)
      canvas.text("BSB/Account:", at: [350, 760])
      canvas.font("Helvetica", size: 10)
      canvas.text(account_code, at: [430, 760])
    end

    # Statement period
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Statement Period:", at: [50, 740])
    canvas.font("Helvetica", size: 10)
    canvas.text("#{start_date.strftime('%d/%m/%Y')} to #{end_date.strftime('%d/%m/%Y')}", at: [150, 740])

    # Source note
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Source: Xero Bank Feed Data", at: [350, 740])
    canvas.fill_color("000000")
  end

  def draw_summary_box(canvas, total_debits, total_credits, closing_balance)
    # Summary box on right side (matching Westpac style)
    box_x = 380
    box_y = 720
    box_width = 180
    box_height = 70

    # Box border
    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    # Summary content - using exact bank statement wording
    y = box_y - 15
    canvas.font("Helvetica", size: 9)

    canvas.text("Total Credits", at: [box_x + 10, y])
    canvas.text("+ #{format_currency(total_credits)}", at: [box_x + 100, y])

    y -= 15
    canvas.text("Total Debits", at: [box_x + 10, y])
    canvas.text("- #{format_currency(total_debits)}", at: [box_x + 100, y])

    # Line before closing balance
    y -= 10
    canvas.line(box_x + 10, y, box_x + box_width - 10, y)
    canvas.stroke

    y -= 15
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Closing Balance", at: [box_x + 10, y])
    prefix = closing_balance >= 0 ? "+ " : "- "
    canvas.text("#{prefix}#{format_currency(closing_balance.abs)}", at: [box_x + 100, y])
  end

  def draw_transactions_section(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Section header bar - exact Westpac style "TRANSACTIONS"
    canvas.fill_color(HEADER_BG_COLOR)
    canvas.rectangle(50, y_start, 495, 20)
    canvas.fill

    canvas.fill_color(HEADER_TEXT_COLOR)
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("TRANSACTIONS", at: [60, y_start + 5])
    canvas.fill_color("000000")

    # Note text below header (like bank statements have)
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    canvas.text("Please check all entries on this statement and promptly inform us of any possible error or unauthorised transaction", at: [60, y_start - 12])
    canvas.fill_color("000000")

    # Column headers - exact bank statement wording
    y = y_start - 30
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("DATE", at: [55, y])
    canvas.text("TRANSACTION DESCRIPTION", at: [120, y])
    canvas.text("DEBIT", at: [355, y])
    canvas.text("CREDIT", at: [420, y])
    canvas.text("BALANCE", at: [485, y])

    # Header underline
    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    # Transaction rows
    y -= 20
    canvas.font("Helvetica", size: 8)

    # Opening balance row (on first page only) - exact wording
    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      opening_bal = @opening_balance

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(first_txn.transaction_date.strftime("%d/%m/%y"), at: [55, y])
      canvas.text("STATEMENT OPENING BALANCE", at: [120, y])
      canvas.text(format_currency(opening_bal), at: [485, y])
      canvas.font("Helvetica", size: 8)

      y -= 15
    end

    transactions_with_balance.each do |item|
      break if y < 80 # Leave room for footer

      txn = item[:txn]
      balance = item[:balance]

      # Date
      canvas.text(txn.transaction_date.strftime("%d/%m/%y"), at: [55, y])

      # Description (contact name or line item description)
      description = build_description(txn)
      # Truncate if too long
      description = description[0..35] + "..." if description.length > 38
      canvas.text(description, at: [120, y])

      # Debit/Credit columns
      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.text(format_currency(amount), at: [355, y])
      else
        canvas.text(format_currency(amount), at: [420, y])
      end

      # Running balance
      canvas.text(format_currency(balance), at: [485, y])

      y -= 15
    end

    # Closing balance row (on last page only) - exact wording
    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 5
      canvas.stroke_color(BORDER_COLOR)
      canvas.line(50, y + 10, 545, y + 10)
      canvas.stroke

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(last_txn.transaction_date.strftime("%d/%m/%y"), at: [55, y])
      canvas.text("CLOSING BALANCE", at: [120, y])
      canvas.text(format_currency(closing_bal), at: [485, y])
    end
  end

  def draw_footer(canvas, page_num, total_pages)
    # Bottom separator line
    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, 60, 545, 60)
    canvas.stroke

    # Disclaimer
    canvas.font("Helvetica", size: 6)
    canvas.fill_color("666666")
    # Wrap the disclaimer
    canvas.text(LEGAL_DISCLAIMER, at: [50, 45])
    canvas.fill_color("000000")

    # Page number centered
    canvas.font("Helvetica", size: 8)
    canvas.text("Page #{page_num} of #{total_pages}", at: [270, 25])
  end

  def build_description(txn)
    # Priority: contact name > line item description > reference
    return txn.contact_name if txn.contact_name.present?

    # Try to get description from line items
    if txn.line_items.present?
      begin
        items = txn.line_items
        items = JSON.parse(items) if items.is_a?(String)
        desc = items.first&.dig("Description")
        return desc if desc.present?
      rescue StandardError
        # ignore
      end
    end

    # Fall back to reference or generic
    txn.reference.presence || "Bank Transaction"
  end

  def format_currency(amount)
    amount = amount.to_f
    formatted = format("%.2f", amount.abs)
    # Add thousand separators
    parts = formatted.split(".")
    parts[0] = parts[0].reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    "$#{parts.join('.')}"
  end

  def generate_filename
    parts = ["Bank_Statement"]

    # Add bank account name if we can get it
    if @bank_account_id.present?
      txn = WarehouseBankTransaction.where(bank_account_id: @bank_account_id).first
      if txn&.bank_account_name.present?
        # Sanitize account name for filename
        safe_name = txn.bank_account_name.gsub(/[^a-zA-Z0-9\-]/, "_").squeeze("_")
        parts << safe_name
      end
    end

    parts << @financial_year if @financial_year.present?
    parts << format("%02d", @month) if @month.present?
    "#{parts.join('_')}.pdf"
  end

  def period_description
    parts = []
    parts << @financial_year if @financial_year.present?
    parts << Date::MONTHNAMES[@month] if @month.present?
    parts << "#{@start_date} to #{@end_date}" if @start_date.present? && @end_date.present?
    parts.join(" - ").presence || "All transactions"
  end
end
