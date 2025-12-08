# frozen_string_literal: true

require "hexapdf"

# Generates a PDF bank statement report from Xero bank feed data.
# Format matches standard bank statement layout with running balance.
# Bank-specific branding applied based on account name.
# Compliant with ATO record-keeping requirements per s262A ITAA 1936.
class BankTransactionReportService
  # Bank-specific branding configuration
  # Each bank has: primary_color, secondary_color, bank_title, account_type
  BANK_BRANDING = {
    nab: {
      primary_color: "C8102E",     # NAB Red
      secondary_color: "000000",   # Black
      bank_title: "NAB",
      account_type: "Business Everyday Account",
      text_on_primary: "FFFFFF"
    },
    westpac: {
      primary_color: "D5002B",     # Westpac Red
      secondary_color: "1F1F1F",   # Dark gray
      bank_title: "Westpac",
      account_type: "Business Account",
      text_on_primary: "FFFFFF"
    },
    boq: {
      primary_color: "00529B",     # BOQ Blue
      secondary_color: "F7941D",   # BOQ Orange accent
      bank_title: "Bank of Queensland",
      account_type: "Business Account",
      text_on_primary: "FFFFFF"
    },
    commbank: {
      primary_color: "FFCC00",     # CommBank Yellow
      secondary_color: "000000",   # Black
      bank_title: "Commonwealth Bank",
      account_type: "Business Account",
      text_on_primary: "000000"    # Black text on yellow
    },
    anz: {
      primary_color: "007DBA",     # ANZ Blue
      secondary_color: "000000",   # Black
      bank_title: "ANZ",
      account_type: "Business Account",
      text_on_primary: "FFFFFF"
    },
    stripe: {
      primary_color: "635BFF",     # Stripe Purple
      secondary_color: "1A1F36",   # Stripe Dark
      bank_title: "Stripe",
      account_type: "Payment Account",
      text_on_primary: "FFFFFF"
    },
    default: {
      primary_color: "5D2E46",     # Maroon (original)
      secondary_color: "333333",
      bank_title: "Bank",
      account_type: "Account",
      text_on_primary: "FFFFFF"
    }
  }.freeze

  BORDER_COLOR = "CCCCCC"        # Light gray borders

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

    # Detect bank branding from account name
    @branding = detect_bank_branding(bank_account_name)

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

    # Generate pages (fewer per page since each has 2-line description)
    transactions_per_page = 22
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
        draw_summary_box(canvas, @opening_balance, total_debits, total_credits, closing_balance)
      end

      # Transactions table
      y_start = is_first_page ? 580 : 720
      draw_transactions_section(canvas, page_transactions, y_start, is_first_page, is_last_page)

      # Footer
      draw_footer(canvas, page_idx + 1, total_pages)
    end

    # Output to string
    output = StringIO.new
    doc.write(output)
    output.string
  end

  # Detect bank from account name and return branding config
  def detect_bank_branding(account_name)
    name = account_name.to_s.downcase
    case name
    when /nab|national australia/
      BANK_BRANDING[:nab]
    when /westpac/
      BANK_BRANDING[:westpac]
    when /boq|bank of queensland/
      BANK_BRANDING[:boq]
    when /comm|cba|commonwealth/
      BANK_BRANDING[:commbank]
    when /anz/
      BANK_BRANDING[:anz]
    when /stripe/
      BANK_BRANDING[:stripe]
    else
      BANK_BRANDING[:default]
    end
  end

  def draw_statement_header(canvas, account_name, account_code, start_date, end_date, page_num, total_pages)
    # Top header bar with bank's primary color
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(0, 790, 595, 52)
    canvas.fill

    # Bank title in header (like "NAB Business Everyday Account")
    canvas.fill_color(@branding[:text_on_primary])
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text(@branding[:bank_title], at: [50, 815])

    canvas.font("Helvetica", size: 11)
    canvas.text(@branding[:account_type], at: [50, 798])

    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_num} of #{total_pages}", at: [500, 815])

    # Reset to black
    canvas.fill_color("000000")

    # Left side: Account name
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text(account_name.upcase, at: [50, 760])

    # Statement period (matching NAB: "Statement starts X / Statement ends Y")
    canvas.font("Helvetica", size: 9)
    canvas.text("Statement starts", at: [50, 745])
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text(format_date_long(start_date), at: [130, 745])

    canvas.font("Helvetica", size: 9)
    canvas.text("Statement ends", at: [50, 730])
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text(format_date_long(end_date), at: [130, 730])

    # Source note (subtle)
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("999999")
    canvas.text("Source: Xero Bank Feed Data", at: [50, 710])
    canvas.fill_color("000000")
  end

  # Format date like "1 Jul 2023" (NAB style)
  def format_date_long(date)
    date.strftime("%-d %b %Y")
  end

  def draw_summary_box(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # Account Balance Summary box (matching NAB style) - positioned top right
    box_x = 350
    box_y = 770
    box_width = 210
    box_height = 100

    # Box border
    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    # Header
    y = box_y - 15
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Account Balance Summary", at: [box_x + 10, y])

    # Line under header
    y -= 8
    canvas.stroke_color(BORDER_COLOR)
    canvas.line(box_x + 10, y, box_x + box_width - 10, y)
    canvas.stroke

    # Summary rows - matching NAB exactly
    y -= 15
    canvas.font("Helvetica", size: 9)

    # Opening balance
    canvas.text("Opening balance", at: [box_x + 10, y])
    canvas.text(format_currency_with_suffix(opening_balance), at: [box_x + 130, y])

    y -= 12
    canvas.text("Total credits", at: [box_x + 10, y])
    canvas.text(format_currency(total_credits), at: [box_x + 130, y])

    y -= 12
    canvas.text("Total debits", at: [box_x + 10, y])
    canvas.text(format_currency(total_debits), at: [box_x + 130, y])

    # Line before closing balance
    y -= 8
    canvas.line(box_x + 10, y, box_x + box_width - 10, y)
    canvas.stroke

    # Closing balance (bold)
    y -= 12
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Closing balance", at: [box_x + 10, y])
    canvas.text(format_currency_with_suffix(closing_balance), at: [box_x + 130, y])
  end

  # Format currency with Cr/Dr suffix like NAB ($37,039.56 Cr)
  def format_currency_with_suffix(amount)
    amount = amount.to_f
    formatted = format_currency(amount.abs)
    suffix = amount >= 0 ? " Cr" : " Dr"
    "#{formatted}#{suffix}"
  end

  def draw_transactions_section(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Section header "Transaction Details" (NAB style - no colored bar)
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.fill_color("000000")
    canvas.text("Transaction Details", at: [50, y_start + 5])

    # Column headers - matching NAB: Date, Particulars, Debits, Credits, Balance
    y = y_start - 15
    canvas.font("Helvetica", size: 8)
    canvas.text("Date", at: [50, y])
    canvas.text("Particulars", at: [110, y])
    canvas.text("Debits", at: [340, y])
    canvas.text("Credits", at: [410, y])
    canvas.text("Balance", at: [480, y])

    # Header underline
    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    # Transaction rows
    y -= 18
    canvas.font("Helvetica", size: 8)

    # Opening balance row (on first page only) - "Brought forward" like NAB
    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      opening_bal = @opening_balance

      canvas.text(format_date_short(first_txn.transaction_date), at: [50, y])
      canvas.text("Brought forward", at: [110, y])
      canvas.text(format_currency_with_suffix(opening_bal), at: [480, y])

      y -= 14
    end

    transactions_with_balance.each do |item|
      break if y < 80 # Leave room for footer

      txn = item[:txn]
      balance = item[:balance]

      # Date (NAB style: "1 Jul 2023")
      canvas.text(format_date_short(txn.transaction_date), at: [50, y])

      # Description - two lines like real bank statements:
      # Line 1: Transaction description (from Xero description field)
      # Line 2: Contact/payee name
      desc_line1, desc_line2 = build_two_line_description(txn)

      # First line - description
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1, at: [110, y])

      # Second line - contact name (same size, indented)
      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.text(desc_line2, at: [115, y - 10])
      end

      # Debit/Credit columns
      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.text(format_currency(amount), at: [340, y])
      else
        canvas.text(format_currency(amount), at: [410, y])
      end

      # Running balance with Cr/Dr suffix
      canvas.text(format_currency_with_suffix(balance), at: [480, y])

      y -= desc_line2.present? ? 22 : 14  # More space for two-line descriptions
    end
  end

  # Format date like "1 Jul 2023" (NAB short style for transactions)
  def format_date_short(date)
    date.strftime("%-d %b %Y")
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
    # Priority: description > contact name > line item description > reference
    return txn.description if txn.description.present?
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

  # Build two-line description like real bank statements
  # Line 1: Transaction description (what happened)
  # Line 2: Contact/payee name (who it was with)
  def build_two_line_description(txn)
    line1 = nil
    line2 = nil

    # Line 1: Get the transaction description
    # Priority: description field > line item description > reference
    if txn.description.present?
      line1 = txn.description
    elsif txn.line_items.present?
      begin
        items = txn.line_items
        items = JSON.parse(items) if items.is_a?(String)
        line1 = items.first&.dig("Description")
      rescue StandardError
        # ignore
      end
    end
    line1 ||= txn.reference.presence

    # Line 2: Contact/payee name (if different from line 1)
    if txn.contact_name.present? && txn.contact_name != line1
      line2 = txn.contact_name
    end

    # If we have no line1, use contact name as line1
    if line1.blank? && txn.contact_name.present?
      line1 = txn.contact_name
      line2 = nil
    end

    line1 ||= "Bank Transaction"

    [line1, line2]
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
