# frozen_string_literal: true

require "hexapdf"

# Generates a PDF report of bank transactions from Xero data.
# This is an accounting record, NOT an official bank statement.
# Compliant with ATO record-keeping requirements per s262A ITAA 1936.
class BankTransactionReportService
  LEGAL_DISCLAIMER = "This document is a transaction report reconstructed from Xero accounting software bank feed data. " \
                     "It is not an official bank statement. Retained as an accounting record per s262A ITAA 1936."

  def initialize(bank_account_id: nil, financial_year: nil, month: nil, start_date: nil, end_date: nil)
    @bank_account_id = bank_account_id
    @financial_year = financial_year
    @month = month
    @start_date = start_date
    @end_date = end_date
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
    { success: false, error: e.message }
  end

  private

  def fetch_transactions
    scope = WarehouseBankTransaction.order(transaction_date: :asc)

    scope = scope.where(bank_account_id: @bank_account_id) if @bank_account_id.present?
    scope = scope.where(financial_year: @financial_year) if @financial_year.present?
    scope = scope.where(transaction_month: @month) if @month.present?
    scope = scope.where("transaction_date >= ?", @start_date) if @start_date.present?
    scope = scope.where("transaction_date <= ?", @end_date) if @end_date.present?

    scope.to_a
  end

  def build_pdf(transactions)
    doc = HexaPDF::Document.new

    # Get bank account info from first transaction
    bank_account_name = transactions.first&.bank_account_name || "Unknown Account"

    # Calculate totals
    money_in = transactions.select { |t| t.transaction_type == "RECEIVE" }.sum(&:total)
    money_out = transactions.select { |t| t.transaction_type == "SPEND" }.sum(&:total)
    net_change = money_in - money_out

    # Group transactions by month for multi-page support
    transactions_by_month = transactions.group_by { |t| t.transaction_date.beginning_of_month }

    page_number = 0
    total_pages = calculate_total_pages(transactions)

    transactions_by_month.each do |month_start, month_transactions|
      # Start new page for each month (or continue if needed)
      pages_for_month = (month_transactions.length / 35.0).ceil
      pages_for_month = 1 if pages_for_month == 0

      month_transactions.each_slice(35).with_index do |page_transactions, page_idx|
        page_number += 1
        page = doc.pages.add(:A4)
        canvas = page.canvas

        # Header
        draw_header(canvas, bank_account_name, page_number, total_pages)

        # Period info
        draw_period_info(canvas, month_start, page_transactions)

        # Transaction table
        draw_transactions_table(canvas, page_transactions)

        # Summary (only on last page of each month)
        if page_idx == pages_for_month - 1
          draw_month_summary(canvas, month_transactions)
        end

        # Footer with legal disclaimer
        draw_footer(canvas)
      end
    end

    # Final summary page
    page_number += 1
    summary_page = doc.pages.add(:A4)
    draw_summary_page(summary_page.canvas, transactions, money_in, money_out, net_change, page_number, total_pages + 1)

    # Output to string
    output = StringIO.new
    doc.write(output)
    output.string
  end

  def calculate_total_pages(transactions)
    transactions_by_month = transactions.group_by { |t| t.transaction_date.beginning_of_month }
    pages = transactions_by_month.sum { |_, txns| (txns.length / 35.0).ceil }
    pages = 1 if pages == 0
    pages
  end

  def draw_header(canvas, bank_account_name, page_number, total_pages)
    # Title
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text("XERO BANK TRANSACTION REPORT", at: [50, 780])

    # Subtitle with account name
    canvas.font("Helvetica", size: 12)
    canvas.text("Account: #{bank_account_name}", at: [50, 755])

    # Page number
    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_number} of #{total_pages + 1}", at: [480, 780])

    # Generated timestamp
    canvas.text("Generated: #{Time.current.strftime('%d %b %Y %H:%M')}", at: [50, 735])

    # Horizontal line
    canvas.line(50, 725, 545, 725)
    canvas.stroke
  end

  def draw_period_info(canvas, month_start, transactions)
    first_date = transactions.map(&:transaction_date).min
    last_date = transactions.map(&:transaction_date).max

    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("Period: #{first_date.strftime('%d %b %Y')} - #{last_date.strftime('%d %b %Y')}", at: [50, 705])
  end

  def draw_transactions_table(canvas, transactions)
    # Table headers
    y_position = 680
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Date", at: [50, y_position])
    canvas.text("Description", at: [110, y_position])
    canvas.text("Type", at: [350, y_position])
    canvas.text("Amount", at: [480, y_position])

    # Header line
    canvas.line(50, y_position - 5, 545, y_position - 5)
    canvas.stroke

    # Transaction rows
    y_position -= 18
    canvas.font("Helvetica", size: 8)

    transactions.each do |txn|
      break if y_position < 100 # Leave room for footer

      # Date
      canvas.text(txn.transaction_date.strftime("%d/%m/%Y"), at: [50, y_position])

      # Description (truncate if too long)
      description = txn.contact_name.presence || extract_description(txn) || "-"
      description = description[0..40] + "..." if description.length > 43
      canvas.text(description, at: [110, y_position])

      # Type
      type_label = txn.transaction_type == "RECEIVE" ? "IN" : "OUT"
      canvas.text(type_label, at: [350, y_position])

      # Amount (formatted)
      amount = format_currency(txn.total)
      amount = txn.transaction_type == "RECEIVE" ? amount : "(#{amount})"
      canvas.text(amount, at: [480, y_position])

      y_position -= 15
    end
  end

  def draw_month_summary(canvas, transactions)
    money_in = transactions.select { |t| t.transaction_type == "RECEIVE" }.sum(&:total)
    money_out = transactions.select { |t| t.transaction_type == "SPEND" }.sum(&:total)

    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Month Total In: #{format_currency(money_in)}", at: [350, 85])
    canvas.text("Month Total Out: #{format_currency(money_out)}", at: [350, 72])
  end

  def draw_footer(canvas)
    # Disclaimer
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    canvas.text(LEGAL_DISCLAIMER, at: [50, 40])
    canvas.fill_color("000000")

    # Bottom line
    canvas.line(50, 55, 545, 55)
    canvas.stroke
  end

  def draw_summary_page(canvas, transactions, money_in, money_out, net_change, page_number, total_pages)
    # Header
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text("TRANSACTION SUMMARY", at: [50, 780])

    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_number} of #{total_pages}", at: [480, 780])

    # Account info
    bank_account_name = transactions.first&.bank_account_name || "Unknown"
    canvas.font("Helvetica", size: 12)
    canvas.text("Account: #{bank_account_name}", at: [50, 750])

    # Period
    first_date = transactions.map(&:transaction_date).min
    last_date = transactions.map(&:transaction_date).max
    canvas.text("Period: #{first_date.strftime('%d %b %Y')} - #{last_date.strftime('%d %b %Y')}", at: [50, 730])

    canvas.line(50, 715, 545, 715)
    canvas.stroke

    # Summary stats
    y = 680
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text("Summary", at: [50, y])

    y -= 30
    canvas.font("Helvetica", size: 11)
    canvas.text("Total Transactions:", at: [50, y])
    canvas.text(transactions.count.to_s, at: [250, y])

    y -= 20
    canvas.text("Money In (Received):", at: [50, y])
    canvas.text(format_currency(money_in), at: [250, y])

    y -= 20
    canvas.text("Money Out (Spent):", at: [50, y])
    canvas.text(format_currency(money_out), at: [250, y])

    y -= 25
    canvas.font("Helvetica", size: 12, variant: :bold)
    canvas.text("Net Change:", at: [50, y])
    canvas.text(format_currency(net_change), at: [250, y])

    # Monthly breakdown
    y -= 50
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text("Monthly Breakdown", at: [50, y])

    y -= 25
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Month", at: [50, y])
    canvas.text("In", at: [200, y])
    canvas.text("Out", at: [300, y])
    canvas.text("Net", at: [400, y])
    canvas.text("Count", at: [480, y])

    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 20
    canvas.font("Helvetica", size: 9)

    transactions.group_by { |t| t.transaction_date.beginning_of_month }.sort.each do |month, txns|
      break if y < 100

      m_in = txns.select { |t| t.transaction_type == "RECEIVE" }.sum(&:total)
      m_out = txns.select { |t| t.transaction_type == "SPEND" }.sum(&:total)
      m_net = m_in - m_out

      canvas.text(month.strftime("%b %Y"), at: [50, y])
      canvas.text(format_currency(m_in), at: [200, y])
      canvas.text(format_currency(m_out), at: [300, y])
      canvas.text(format_currency(m_net), at: [400, y])
      canvas.text(txns.count.to_s, at: [480, y])

      y -= 15
    end

    # Footer
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    canvas.text(LEGAL_DISCLAIMER, at: [50, 40])
    canvas.fill_color("000000")
    canvas.line(50, 55, 545, 55)
    canvas.stroke
  end

  def extract_description(txn)
    return nil unless txn.line_items.present?

    items = txn.line_items
    items = JSON.parse(items) if items.is_a?(String)
    items.first&.dig("Description")
  rescue StandardError
    nil
  end

  def format_currency(amount)
    "$#{'%.2f' % amount.to_f}"
  end

  def generate_filename
    parts = ["Xero_Transaction_Report"]
    parts << @financial_year if @financial_year.present?
    parts << Date::MONTHNAMES[@month] if @month.present?
    parts << Time.current.strftime("%Y%m%d")
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
