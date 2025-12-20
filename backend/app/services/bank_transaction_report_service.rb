# frozen_string_literal: true

require "hexapdf"

# Generates a PDF bank statement report from Xero bank feed data.
# Format matches standard bank statement layout with running balance.
# Bank-specific branding applied based on account name.
# Compliant with ATO record-keeping requirements per s262A ITAA 1936.
#
# SSoT: BankStatementTemplate model is the source of truth for branding.
# Templates are managed via Admin > System > Company > Doc Templates > Bank Statements
class BankTransactionReportService
  # DEPRECATED: Use BankStatementTemplate model instead
  # This constant is only used as fallback when templates table doesn't exist
  BANK_BRANDING_FALLBACK = {
    nab: {
      primary_color: "C20000",     # NAB Guardsman Red (updated Dec 2024)
      secondary_color: "000000",
      bank_title: "NAB",
      account_type: "Business Everyday Account",
      text_on_primary: "FFFFFF"
    },
    westpac: {
      primary_color: "DA1710",     # Westpac GEL Red (updated Dec 2024)
      secondary_color: "1F1F1F",
      bank_title: "Westpac",
      account_type: "Westpac Business One",
      text_on_primary: "FFFFFF"
    },
    boq: {
      primary_color: "1B75BC",       # Official BOQ Denim Blue (from Brandfetch)
      secondary_color: "FEBD36",     # Official BOQ Sunglow Gold (from Brandfetch)
      bank_title: "Bank of Queensland",
      account_type: "Business Statement",
      text_on_primary: "FFFFFF"
    },
    commbank: {
      primary_color: "FFCC00",
      secondary_color: "000000",
      bank_title: "Commonwealth Bank",
      account_type: "Business Account",
      text_on_primary: "000000"
    },
    anz: {
      primary_color: "007DBA",
      secondary_color: "000000",
      bank_title: "ANZ",
      account_type: "Business Account",
      text_on_primary: "FFFFFF"
    },
    stripe: {
      primary_color: "635BFF",
      secondary_color: "0A2540",   # Stripe Downriver (updated Dec 2024)
      bank_title: "Stripe",
      account_type: "Payment Account",
      text_on_primary: "FFFFFF"
    },
    default: {
      primary_color: "000000",       # TEEEM brand primary = black
      secondary_color: "0064D9",     # TEEEM brand accent blue
      bank_title: "TEEEM",
      account_type: "Account",
      text_on_primary: "FFFFFF"
    }
  }.freeze

  BORDER_COLOR = "CCCCCC"        # Light gray borders

  LEGAL_DISCLAIMER = "This document is a transaction record reconstructed from Xero accounting software bank feed data. " \
                     "It is not an official bank statement. Retained as an accounting record per s262A ITAA 1936."

  def initialize(bank_account_id: nil, bank_account: nil, financial_year: nil, month: nil, start_date: nil, end_date: nil, opening_balance: nil, transactions: nil, account_name: nil, template: nil)
    @bank_account_id = bank_account_id
    @financial_year = financial_year
    @month = month
    @start_date = start_date
    @end_date = end_date
    @opening_balance = opening_balance || BigDecimal("0")

    # Sample mode: use provided transactions and template directly
    @sample_transactions = transactions
    @sample_account_name = account_name
    @provided_template = template

    # Bank account record - can be passed directly or looked up via xero_account_id
    @bank_account_record = bank_account || BankAccount.find_by(xero_account_id: @bank_account_id) if bank_account.present? || @bank_account_id.present?
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
    # Sample mode: return provided transactions wrapped in OpenStruct for consistent interface
    if @sample_transactions.present?
      return @sample_transactions.map do |txn|
        OpenStruct.new(
          transaction_date: txn[:date],
          description: txn[:description],
          total: txn[:amount].abs,
          transaction_type: txn[:amount] >= 0 ? "RECEIVE" : "SPEND",
          contact_name: nil,
          reference: nil,
          line_items: nil,
          bank_account_name: @sample_account_name,
          bank_account_code: nil
        )
      end
    end

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

      # Transactions table - y_start varies by bank layout
      y_start = if is_first_page
                  case @bank_type
                  when :anz then 530      # ANZ has taller summary section
                  when :commbank then 560 # CommBank needs more space
                  else 580                # Default for NAB, Westpac, BOQ, TEEEM
                  end
                else
                  720
                end
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
  # SSoT: Uses BankStatementTemplate model first, falls back to BANK_BRANDING_FALLBACK
  def detect_bank_branding(account_name)
    # Use provided template if in sample mode
    if @provided_template.present?
      @template = @provided_template
      @bank_type = @template.layout_style&.to_sym || :default
      return @template.to_branding_hash
    end

    # Try to load from database templates (SSoT)
    @template = load_template_from_db(account_name)

    if @template.present?
      @bank_type = @template.layout_style&.to_sym || :default
      @template.to_branding_hash
    else
      # Fallback to hardcoded config if templates table doesn't exist
      detect_bank_branding_fallback(account_name)
    end
  end

  # Load template from BankStatementTemplate model
  def load_template_from_db(account_name)
    return nil unless defined?(BankStatementTemplate) && BankStatementTemplate.table_exists?

    BankStatementTemplate.for_bank(account_name)
  rescue StandardError => e
    Rails.logger.warn("BankStatementTemplate lookup failed: #{e.message}")
    nil
  end

  # Fallback detection when templates table not available
  def detect_bank_branding_fallback(account_name)
    name = account_name.to_s.downcase
    case name
    when /nab|national australia/
      @bank_type = :nab
      BANK_BRANDING_FALLBACK[:nab]
    when /westpac/
      @bank_type = :westpac
      BANK_BRANDING_FALLBACK[:westpac]
    when /boq|bank of queensland/
      @bank_type = :boq
      BANK_BRANDING_FALLBACK[:boq]
    when /comm|cba|commonwealth/
      @bank_type = :commbank
      BANK_BRANDING_FALLBACK[:commbank]
    when /anz/
      @bank_type = :anz
      BANK_BRANDING_FALLBACK[:anz]
    when /stripe/
      @bank_type = :stripe
      BANK_BRANDING_FALLBACK[:stripe]
    else
      @bank_type = :default
      BANK_BRANDING_FALLBACK[:default]
    end
  end

  # Route to bank-specific header method
  def draw_statement_header(canvas, account_name, account_code, start_date, end_date, page_num, total_pages)
    case @bank_type
    when :westpac
      draw_westpac_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    when :boq
      draw_boq_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    when :commbank
      draw_commbank_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    when :anz
      draw_anz_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    when :default
      draw_teeem_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    else
      draw_nab_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    end
  end

  # Route to bank-specific summary box method
  def draw_summary_box(canvas, opening_balance, total_debits, total_credits, closing_balance)
    case @bank_type
    when :westpac
      draw_westpac_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    when :boq
      draw_boq_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    when :commbank
      draw_commbank_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    when :anz
      draw_anz_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    when :default
      draw_teeem_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    else
      draw_nab_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    end
  end

  # Route to bank-specific transactions section
  def draw_transactions_section(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    case @bank_type
    when :westpac
      draw_westpac_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    when :boq
      draw_boq_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    when :commbank
      draw_commbank_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    when :anz
      draw_anz_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    when :default
      draw_teeem_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    else
      draw_nab_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    end
  end

  # ============================================================================
  # NAB Style Layout
  # Based on official NAB Business Everyday Account statement
  # ============================================================================

  def draw_nab_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # NAB Logo (red star + "nab" text) - top left
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(50, 795, 20, 20)
    canvas.fill

    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 24, variant: :bold)
    canvas.text("nab", at: [ 75, 798 ])

    # Account title and contact info - top right (page number is in footer)
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("NAB Business Everyday Account", at: [ 380, 810 ])
    canvas.font("Helvetica", size: 7)
    canvas.text("For further information call the", at: [ 380, 796 ])
    canvas.text("Business Servicing Team on 13 10 12", at: [ 380, 786 ])

    # Get company/account details
    if @bank_account_record.present?
      company_name = @bank_account_record.corporate_company&.name || @bank_account_record.account_name || account_name
      bsb = @bank_account_record.formatted_bsb || @bank_account_record.bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      company_name = account_name
      bsb = "-"
      account_number = "-"
    end

    # Store for summary
    @nab_bsb = bsb
    @nab_account_number = account_number
    @nab_company_name = company_name
    @nab_start_date = start_date
    @nab_end_date = end_date

    # Business Name/Address box (left side) - gold bordered
    addr_box_x = 50
    addr_box_y = 760
    addr_box_w = 200
    addr_box_h = 55
    canvas.stroke_color("D4A017")
    canvas.line_width(1.5)
    canvas.rectangle(addr_box_x, addr_box_y - addr_box_h, addr_box_w, addr_box_h)
    canvas.stroke

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text(company_name.upcase, at: [ addr_box_x + 10, addr_box_y - 18 ])
    canvas.font("Helvetica", size: 8)
    canvas.text("AUSTRALIA", at: [ addr_box_x + 10, addr_box_y - 32 ])
  end

  def draw_nab_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # Account Balance Summary - right side, aligned with address box
    box_x = 320
    box_y = 760

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Account Balance Summary", at: [ box_x, box_y ])
    canvas.stroke_color("000000")
    canvas.line_width(0.5)
    canvas.line(box_x, box_y - 2, box_x + 130, box_y - 2)
    canvas.stroke

    y = box_y - 15
    canvas.font("Helvetica", size: 8)

    canvas.text("Opening balance", at: [ box_x, y ])
    canvas.text(format_currency_cr_dr(opening_balance), at: [ box_x + 100, y ])

    y -= 10
    canvas.text("Total credits", at: [ box_x, y ])
    canvas.text(format_currency(total_credits), at: [ box_x + 100, y ])

    y -= 10
    canvas.text("Total debits", at: [ box_x, y ])
    canvas.text(format_currency(total_debits), at: [ box_x + 100, y ])

    y -= 10
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("Closing balance", at: [ box_x, y ])
    canvas.text(format_currency_cr_dr(closing_balance), at: [ box_x + 100, y ])

    # Statement dates
    y -= 14
    canvas.font("Helvetica", size: 8)
    canvas.text("Statement starts  #{format_date_nab(@nab_start_date || Date.current)}", at: [ box_x, y ])
    y -= 10
    canvas.text("Statement ends   #{format_date_nab(@nab_end_date || Date.current)}", at: [ box_x, y ])

    # Account Details box - below address box on left
    details_box_x = 50
    details_box_y = 690
    details_box_w = 200
    details_box_h = 50

    canvas.stroke_color("D4A017")
    canvas.line_width(1.5)
    canvas.rectangle(details_box_x, details_box_y - details_box_h, details_box_w, details_box_h)
    canvas.stroke

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Account Details", at: [ details_box_x + 10, details_box_y - 12 ])
    canvas.stroke_color("000000")
    canvas.line(details_box_x + 10, details_box_y - 14, details_box_x + 80, details_box_y - 14)
    canvas.stroke

    canvas.font("Helvetica", size: 8)
    canvas.text("BSB number", at: [ details_box_x + 10, details_box_y - 28 ])
    canvas.text(@nab_bsb || "-", at: [ details_box_x + 80, details_box_y - 28 ])
    canvas.text("Account number", at: [ details_box_x + 10, details_box_y - 40 ])
    canvas.text(@nab_account_number || "-", at: [ details_box_x + 80, details_box_y - 40 ])
  end

  def draw_nab_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Column right edges for right-alignment
    debit_col_right = 390
    credit_col_right = 460
    balance_col_right = 545

    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.fill_color("000000")
    canvas.text("Transaction Details", at: [ 50, y_start + 5 ])

    y = y_start - 15
    canvas.font("Helvetica", size: 8)
    canvas.text("Date", at: [ 50, y ])
    canvas.text("Particulars", at: [ 110, y ])
    # Right-align column headers
    draw_right_aligned_text(canvas, "Debits", debit_col_right, y)
    draw_right_aligned_text(canvas, "Credits", credit_col_right, y)
    draw_right_aligned_text(canvas, "Balance", balance_col_right, y)

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 18
    canvas.font("Helvetica", size: 8)

    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.text(format_date_nab(first_txn.transaction_date), at: [ 50, y ])
      canvas.text("Brought forward", at: [ 110, y ])
      draw_right_aligned_text(canvas, format_currency_cr_dr(@opening_balance), balance_col_right, y)
      y -= 14
    end

    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      canvas.text(format_date_nab(txn.transaction_date), at: [ 50, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1, at: [ 110, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.text(desc_line2, at: [ 115, y - 10 ])
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        draw_right_aligned_text(canvas, format_currency(amount), debit_col_right, y)
      else
        draw_right_aligned_text(canvas, format_currency(amount), credit_col_right, y)
      end

      draw_right_aligned_text(canvas, format_currency_cr_dr(balance), balance_col_right, y)
      y -= desc_line2.present? ? 22 : 14
    end
  end

  # ============================================================================
  # Westpac Style Layout
  # Based on official Westpac Business Account Statement format
  # ============================================================================

  def draw_westpac_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # Westpac Business Statement layout
    # Logo on left, stacked info boxes on right

    # Westpac "W" logo area (red rectangle with white W)
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(50, 760, 60, 60)
    canvas.fill
    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 32, variant: :bold)
    canvas.text("W", at: [ 63, 778 ])

    # "Westpac" title next to logo
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 20, variant: :bold)
    canvas.text("Westpac", at: [ 120, 790 ])

    # Account type below bank name
    canvas.font("Helvetica", size: 11)
    canvas.fill_color("666666")
    canvas.text("Business Transaction Account", at: [ 120, 772 ])
    canvas.fill_color("000000")

    # Right side: vertically stacked boxes
    box_x = 300
    box_width = 260

    # Box 1: Statement Period (top)
    box1_top = 820
    box1_height = 40
    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(0.5)
    canvas.rectangle(box_x, box1_top - box1_height, box_width, box1_height)
    canvas.stroke

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Statement Period", at: [ box_x + 10, box1_top - 12 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("#{format_date_westpac_long(start_date)} - #{format_date_westpac_long(end_date)}", at: [ box_x + 10, box1_top - 28 ])

    # Box 2: Account Name (below statement period)
    box2_top = box1_top - box1_height
    box2_height = 55
    canvas.rectangle(box_x, box2_top - box2_height, box_width, box2_height)
    canvas.stroke

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Account Name", at: [ box_x + 10, box2_top - 12 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text(account_name.upcase, at: [ box_x + 10, box2_top - 26 ])

    # BSB and Account Number from BankAccount record
    if @bank_account_record.present?
      bsb = @bank_account_record.formatted_bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      bsb = "-"
      account_number = "-"
    end

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("BSB", at: [ box_x + 10, box2_top - 42 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9)
    canvas.text(bsb, at: [ box_x + 50, box2_top - 42 ])

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Account", at: [ box_x + 130, box2_top - 42 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9)
    canvas.text(account_number, at: [ box_x + 175, box2_top - 42 ])

    # Store where summary should start
    @westpac_summary_top = box2_top - box2_height
  end

  def draw_westpac_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # Box 3: Summary (below account info, aligned with header boxes)
    box_x = 300
    box_width = 260
    box_top = @westpac_summary_top || 725
    box_height = 90

    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(0.5)
    canvas.rectangle(box_x, box_top - box_height, box_width, box_height)
    canvas.stroke

    y = box_top - 18
    canvas.font("Helvetica", size: 9)

    # Opening Balance
    canvas.fill_color("666666")
    canvas.text("Opening Balance", at: [ box_x + 10, y ])
    canvas.fill_color("000000")
    canvas.text(format_currency(opening_balance), at: [ box_x + 180, y ])

    # Total Credits
    y -= 18
    canvas.fill_color("666666")
    canvas.text("Total Credits", at: [ box_x + 10, y ])
    canvas.fill_color("009900")
    canvas.text("+ #{format_currency(total_credits)}", at: [ box_x + 180, y ])

    # Total Debits
    y -= 18
    canvas.fill_color("666666")
    canvas.text("Total Debits", at: [ box_x + 10, y ])
    canvas.fill_color("CC0000")
    canvas.text("- #{format_currency(total_debits)}", at: [ box_x + 180, y ])

    # Closing Balance (highlighted row)
    y -= 22
    canvas.fill_color("F5F5F5")
    canvas.rectangle(box_x + 1, y - 6, box_width - 2, 18)
    canvas.fill

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Closing Balance", at: [ box_x + 10, y ])
    prefix = closing_balance >= 0 ? "+ " : ""
    color = closing_balance >= 0 ? "009900" : "CC0000"
    canvas.fill_color(color)
    canvas.text("#{prefix}#{format_currency(closing_balance)}", at: [ box_x + 180, y ])
    canvas.fill_color("000000")
  end

  def draw_westpac_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Maroon "TRANSACTIONS" bar
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(50, y_start, 495, 20)
    canvas.fill

    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("TRANSACTIONS", at: [ 60, y_start + 5 ])

    # Disclaimer text
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 7)
    canvas.text("Please check all entries on this statement and promptly inform Westpac of any possible error or unauthorised transaction", at: [ 60, y_start - 12 ])

    # Column headers
    y = y_start - 28
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("DATE", at: [ 55, y ])
    canvas.text("TRANSACTION DESCRIPTION", at: [ 120, y ])
    canvas.text("DEBIT", at: [ 355, y ])
    canvas.text("CREDIT", at: [ 420, y ])
    canvas.text("BALANCE", at: [ 485, y ])

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 18
    canvas.font("Helvetica", size: 8)

    # Opening balance row
    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_westpac(first_txn.transaction_date), at: [ 55, y ])
      canvas.text("STATEMENT OPENING BALANCE", at: [ 120, y ])
      canvas.text(format_currency(@opening_balance), at: [ 485, y ])
      canvas.font("Helvetica", size: 8)
      y -= 15
    end

    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      canvas.text(format_date_westpac(txn.transaction_date), at: [ 55, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..42] + "..." if desc_line1.length > 45
      canvas.text(desc_line1, at: [ 120, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..42] + "..." if desc_line2.length > 45
        canvas.font("Helvetica", size: 7)
        canvas.text(desc_line2, at: [ 120, y - 9 ])
        canvas.font("Helvetica", size: 8)
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.text(format_currency(amount), at: [ 355, y ])
      else
        canvas.text(format_currency(amount), at: [ 420, y ])
      end

      canvas.text(format_currency(balance), at: [ 485, y ])
      y -= desc_line2.present? ? 20 : 14
    end

    # Closing balance row
    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 5
      canvas.stroke_color(BORDER_COLOR)
      canvas.line(50, y + 10, 545, y + 10)
      canvas.stroke

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_westpac(last_txn.transaction_date), at: [ 55, y ])
      canvas.text("CLOSING BALANCE", at: [ 120, y ])
      canvas.text(format_currency(closing_bal), at: [ 485, y ])
    end
  end

  # ============================================================================
  # BOQ (Bank of Queensland) Style Layout
  # Based on official BOQ Business Account Statement format
  # ============================================================================

  def draw_boq_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # Blue header bar with orange accent
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(0, 790, 595, 52)
    canvas.fill

    # Orange accent stripe
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(0, 790, 8, 52)
    canvas.fill

    # Bank name in header
    canvas.fill_color(@branding[:text_on_primary])
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text("Bank of Queensland", at: [ 50, 815 ])

    canvas.font("Helvetica", size: 10)
    canvas.text("Business Transaction Account", at: [ 50, 798 ])

    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_num} of #{total_pages}", at: [ 500, 815 ])

    # Reset to black
    canvas.fill_color("000000")

    # Get company/account details
    if @bank_account_record.present?
      company_name = @bank_account_record.corporate_company&.name || account_name
      bsb = @bank_account_record.formatted_bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      company_name = account_name
      bsb = "-"
      account_number = "-"
    end

    # Company name/address - left side
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text(company_name.upcase, at: [ 50, 755 ])
    canvas.font("Helvetica", size: 9)
    canvas.text("AUSTRALIA", at: [ 50, 742 ])

    # Account details - right side
    box_x = 350
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("BSB", at: [ box_x, 755 ])
    canvas.text("Account Number", at: [ box_x + 80, 755 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text(bsb, at: [ box_x, 742 ])
    canvas.text(account_number, at: [ box_x + 80, 742 ])

    # Statement period
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Statement Period", at: [ box_x, 722 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text("#{format_date_boq(start_date)} to #{format_date_boq(end_date)}", at: [ box_x, 709 ])
  end

  def draw_boq_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    box_x = 320
    box_y = 720
    box_width = 230
    box_height = 80

    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    y = box_y - 15
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Account Summary", at: [ box_x + 10, y ])

    y -= 8
    canvas.line(box_x + 10, y, box_x + box_width - 10, y)
    canvas.stroke

    y -= 15
    canvas.font("Helvetica", size: 9)
    canvas.text("Opening Balance", at: [ box_x + 10, y ])
    canvas.text(format_currency(opening_balance), at: [ box_x + 130, y ])

    y -= 12
    canvas.text("Total Credits", at: [ box_x + 10, y ])
    canvas.text(format_currency(total_credits), at: [ box_x + 130, y ])

    y -= 12
    canvas.text("Total Debits", at: [ box_x + 10, y ])
    canvas.text(format_currency(total_debits), at: [ box_x + 130, y ])

    y -= 8
    canvas.line(box_x + 10, y, box_x + box_width - 10, y)
    canvas.stroke

    y -= 12
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Closing Balance", at: [ box_x + 10, y ])
    canvas.text(format_currency(closing_balance), at: [ box_x + 130, y ])
  end

  def draw_boq_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Blue "Transaction Details" header
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(50, y_start, 495, 20)
    canvas.fill

    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Transaction Details", at: [ 60, y_start + 5 ])

    # Column headers
    y = y_start - 20
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("Date", at: [ 55, y ])
    canvas.text("Transaction", at: [ 120, y ])
    canvas.text("Debit", at: [ 355, y ])
    canvas.text("Credit", at: [ 420, y ])
    canvas.text("Balance", at: [ 485, y ])

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 18
    canvas.font("Helvetica", size: 8)

    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.text(format_date_boq(first_txn.transaction_date), at: [ 55, y ])
      canvas.text("Opening Balance", at: [ 120, y ])
      canvas.text(format_currency(@opening_balance), at: [ 485, y ])
      y -= 14
    end

    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      canvas.text(format_date_boq(txn.transaction_date), at: [ 55, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1, at: [ 120, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.font("Helvetica", size: 7)
        canvas.text(desc_line2, at: [ 120, y - 9 ])
        canvas.font("Helvetica", size: 8)
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.text(format_currency(amount), at: [ 355, y ])
      else
        canvas.text(format_currency(amount), at: [ 420, y ])
      end

      canvas.text(format_currency(balance), at: [ 485, y ])
      y -= desc_line2.present? ? 20 : 14
    end

    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 5
      canvas.stroke_color(BORDER_COLOR)
      canvas.line(50, y + 10, 545, y + 10)
      canvas.stroke

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_boq(last_txn.transaction_date), at: [ 55, y ])
      canvas.text("Closing Balance", at: [ 120, y ])
      canvas.text(format_currency(closing_bal), at: [ 485, y ])
    end
  end

  # ============================================================================
  # CommBank (Commonwealth Bank) Style Layout
  # Based on official CommBank Business Account Statement format
  # ============================================================================

  def draw_commbank_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # CommBank Business Statement layout
    # Yellow diamond logo - top left
    canvas.fill_color(@branding[:primary_color])
    # Draw diamond shape (rotated square)
    canvas.save_graphics_state
    canvas.transform(1, 0, 0, 1, 75, 805)
    canvas.rotate(45, origin: [ 0, 0 ])
    canvas.rectangle(-18, -18, 36, 36)
    canvas.fill
    canvas.restore_graphics_state

    # "Business Transaction Account" title
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text("Business Transaction Account", at: [ 120, 810 ])

    # Statement subtitle
    canvas.font("Helvetica", size: 12)
    canvas.text("Statement", at: [ 120, 792 ])

    # Page number - top right
    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_num} of #{total_pages}", at: [ 500, 815 ])

    # Get company/account details
    if @bank_account_record.present?
      company_name = @bank_account_record.corporate_company&.name || account_name
      bsb = @bank_account_record.formatted_bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      company_name = account_name
      bsb = "-"
      account_number = "-"
    end

    # Customer name/address - left side
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text(company_name.upcase, at: [ 50, 745 ])
    canvas.font("Helvetica", size: 9)
    canvas.text("AUSTRALIA", at: [ 50, 732 ])

    # Account details box - right side
    box_x = 350
    box_y = 760

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("BSB", at: [ box_x, box_y ])
    canvas.text("Account number", at: [ box_x + 80, box_y ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text(bsb, at: [ box_x, box_y - 12 ])
    canvas.text(account_number, at: [ box_x + 80, box_y - 12 ])

    # Statement period
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Statement period", at: [ box_x, box_y - 30 ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text("#{format_date_commbank(start_date)} - #{format_date_commbank(end_date)}", at: [ box_x, box_y - 42 ])

    # Store for summary
    @commbank_company_name = company_name
    @commbank_bsb = bsb
    @commbank_account_number = account_number
  end

  def draw_commbank_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # Account summary section
    box_x = 50
    box_y = 700
    box_width = 500
    box_height = 85

    # Yellow top border
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(box_x, box_y, box_width, 4)
    canvas.fill

    # Light gray background
    canvas.fill_color("F5F5F5")
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.fill

    # "Account summary" title
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 12, variant: :bold)
    canvas.text("Account summary", at: [ box_x + 15, box_y - 20 ])

    # Summary values - 4 columns
    col_width = 120
    y = box_y - 45

    # Opening balance
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Opening balance", at: [ box_x + 15, y ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text(format_currency(opening_balance), at: [ box_x + 15, y - 14 ])

    # Money in (credits)
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Money in", at: [ box_x + 15 + col_width, y ])
    canvas.fill_color("009900")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("+#{format_currency(total_credits)}", at: [ box_x + 15 + col_width, y - 14 ])

    # Money out (debits)
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Money out", at: [ box_x + 15 + col_width * 2, y ])
    canvas.fill_color("CC0000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("-#{format_currency(total_debits)}", at: [ box_x + 15 + col_width * 2, y - 14 ])

    # Closing balance
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Closing balance", at: [ box_x + 15 + col_width * 3, y ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text(format_currency(closing_balance), at: [ box_x + 15 + col_width * 3, y - 14 ])

    canvas.fill_color("000000")
  end

  def draw_commbank_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Transactions header with yellow accent
    canvas.font("Helvetica", size: 12, variant: :bold)
    canvas.fill_color("000000")
    canvas.text("Transactions", at: [ 50, y_start + 5 ])

    # Yellow underline
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(50, y_start - 3, 85, 3)
    canvas.fill

    # Column headers
    y = y_start - 20
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("Date", at: [ 55, y ])
    canvas.text("Transaction", at: [ 120, y ])
    canvas.text("Money out", at: [ 350, y ])
    canvas.text("Money in", at: [ 420, y ])
    canvas.text("Balance", at: [ 490, y ])

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 18
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8)

    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_commbank(first_txn.transaction_date), at: [ 55, y ])
      canvas.text("Opening Balance", at: [ 120, y ])
      canvas.text(format_currency(@opening_balance), at: [ 490, y ])
      canvas.font("Helvetica", size: 8)
      y -= 14
    end

    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      canvas.text(format_date_commbank(txn.transaction_date), at: [ 55, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1, at: [ 120, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.font("Helvetica", size: 7)
        canvas.fill_color("666666")
        canvas.text(desc_line2, at: [ 120, y - 9 ])
        canvas.fill_color("000000")
        canvas.font("Helvetica", size: 8)
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.fill_color("CC0000")
        canvas.text("-#{format_currency(amount)}", at: [ 350, y ])
        canvas.fill_color("000000")
      else
        canvas.fill_color("009900")
        canvas.text("+#{format_currency(amount)}", at: [ 420, y ])
        canvas.fill_color("000000")
      end

      canvas.text(format_currency(balance), at: [ 490, y ])
      y -= desc_line2.present? ? 20 : 14
    end

    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 5
      canvas.stroke_color(BORDER_COLOR)
      canvas.line(50, y + 10, 545, y + 10)
      canvas.stroke

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_commbank(last_txn.transaction_date), at: [ 55, y ])
      canvas.text("Closing Balance", at: [ 120, y ])
      canvas.text(format_currency(closing_bal), at: [ 490, y ])
    end
  end

  # ============================================================================
  # ANZ Style Layout
  # Based on official ANZ Business Account Statement format
  # Reference: /backend/reference_statements/ANZ_business_statement_guide.png
  # ============================================================================

  def draw_anz_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # ANZ Business Statement - white background with blue accents
    # ANZ logo (blue "ANZ" with floating dots symbol) - top right
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 28, variant: :bold)
    canvas.text("ANZ", at: [ 480, 810 ])

    # Floating dots (simplified as small circles)
    canvas.fill_color(@branding[:primary_color])
    canvas.circle(540, 820, 4)
    canvas.fill
    canvas.circle(550, 812, 3)
    canvas.fill
    canvas.circle(555, 825, 2)
    canvas.fill

    # Statement title - centered, blue
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text("ANZ BUSINESS ACCOUNT STATEMENT", at: [ 140, 810 ])

    # Statement number and date range
    canvas.font("Helvetica", size: 9)
    canvas.text("STATEMENT NUMBER #{page_num}", at: [ 220, 795 ])
    canvas.text("#{format_date_anz_long(start_date).upcase} TO #{format_date_anz_long(end_date).upcase}", at: [ 195, 783 ])

    # Get company/account details
    if @bank_account_record.present?
      company_name = @bank_account_record.corporate_company&.name || account_name
      bsb = @bank_account_record.formatted_bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      company_name = account_name
      bsb = "-"
      account_number = "-"
    end

    # Customer name/address - left side
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text(company_name, at: [ 50, 740 ])
    canvas.text("AUSTRALIA", at: [ 50, 728 ])

    # Store for summary
    @anz_bsb = bsb
    @anz_account_number = account_number
    @anz_company_name = company_name
    @anz_start_date = start_date
    @anz_end_date = end_date
  end

  def draw_anz_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # "WELCOME TO YOUR ANZ ACCOUNT AT A GLANCE" section header
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("WELCOME TO YOUR ANZ ACCOUNT AT A GLANCE", at: [ 50, 680 ])

    # Account Details - left side
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8)
    canvas.text("Account Details", at: [ 50, 660 ])

    canvas.font("Helvetica", size: 10)
    canvas.text(@anz_company_name || "-", at: [ 50, 645 ])

    canvas.font("Helvetica", size: 8)
    canvas.text("Branch Number (BSB)", at: [ 50, 625 ])
    canvas.font("Helvetica", size: 10)
    canvas.text(@anz_bsb || "-", at: [ 50, 612 ])

    canvas.font("Helvetica", size: 8)
    canvas.text("Account Number", at: [ 50, 595 ])
    canvas.font("Helvetica", size: 10)
    canvas.text(@anz_account_number || "-", at: [ 50, 582 ])

    # Balance Summary Box - right side with light blue gradient background
    box_x = 300
    box_y = 670
    box_width = 250
    box_height = 110

    # Light blue background for balance box
    canvas.fill_color("E6F3FA")
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.fill

    y = box_y - 20

    # Opening Balance
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 8)
    canvas.text("Opening Balance:", at: [ box_x + 10, y ])
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 16, variant: :bold)
    canvas.text(format_currency(opening_balance), at: [ box_x + 120, y - 2 ])

    # Total Deposits
    y -= 22
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 8)
    canvas.text("Total Deposits:", at: [ box_x + 10, y ])
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 14)
    canvas.text(format_currency(total_credits), at: [ box_x + 120, y - 2 ])

    # Total Withdrawals
    y -= 20
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 8)
    canvas.text("Total Withdrawals:", at: [ box_x + 10, y ])
    canvas.fill_color(@branding[:primary_color])
    canvas.font("Helvetica", size: 14)
    canvas.text(format_currency(total_debits), at: [ box_x + 120, y - 2 ])

    # Closing Balance - dark blue highlighted row
    y -= 25
    canvas.fill_color("005A9C")  # Dark blue
    canvas.rectangle(box_x, y - 15, box_width, 30)
    canvas.fill

    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 8)
    canvas.text("Closing Balance:", at: [ box_x + 10, y ])
    canvas.font("Helvetica", size: 18, variant: :bold)
    canvas.text(format_currency(closing_balance), at: [ box_x + 100, y - 2 ])

    canvas.fill_color("000000")
  end

  def draw_anz_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Transaction Details header
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Transaction details", at: [ 50, y_start + 5 ])
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    canvas.text("Please retain this statement for taxation purposes", at: [ 180, y_start + 5 ])

    # Column headers
    y = y_start - 15
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("Date", at: [ 55, y ])
    canvas.text("Transaction description", at: [ 120, y ])
    canvas.text("Debits ($)", at: [ 350, y ])
    canvas.text("Credits ($)", at: [ 420, y ])
    canvas.text("Balance ($)", at: [ 490, y ])

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 5, 545, y - 5)
    canvas.stroke

    y -= 18
    canvas.font("Helvetica", size: 8)

    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_anz(first_txn.transaction_date), at: [ 55, y ])
      canvas.text("BALANCE BROUGHT FORWARD", at: [ 120, y ])
      canvas.text(format_currency(@opening_balance), at: [ 490, y ])
      canvas.font("Helvetica", size: 8)
      y -= 14
    end

    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      canvas.text(format_date_anz(txn.transaction_date), at: [ 55, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1.upcase, at: [ 120, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.font("Helvetica", size: 7)
        canvas.text(desc_line2, at: [ 120, y - 9 ])
        canvas.font("Helvetica", size: 8)
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.text(format_currency(amount), at: [ 350, y ])
      else
        canvas.text(format_currency(amount), at: [ 420, y ])
      end

      canvas.text(format_currency(balance), at: [ 490, y ])
      y -= desc_line2.present? ? 20 : 14
    end

    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 5
      canvas.stroke_color(BORDER_COLOR)
      canvas.line(50, y + 10, 545, y + 10)
      canvas.stroke

      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date_anz(last_txn.transaction_date), at: [ 55, y ])
      canvas.text("CLOSING BALANCE", at: [ 120, y ])
      canvas.text(format_currency(closing_bal), at: [ 490, y ])
    end
  end

  # ANZ long date format: "28 MARCH 2018"
  def format_date_anz_long(date)
    date.strftime("%-d %B %Y")
  end

  # ============================================================================
  # TEEEM Style Layout (Premium/Default)
  # Modern, sophisticated fintech-style layout for internal statements
  # Design: Clean lines, bold typography, strategic use of blue accent
  # ============================================================================

  def draw_teeem_header(canvas, account_name, start_date, end_date, page_num, total_pages)
    # Premium header - clean black bar with refined typography
    header_height = 65
    header_top = 842

    # Main black header
    canvas.fill_color(@branding[:primary_color])
    canvas.rectangle(0, header_top - header_height, 595, header_height)
    canvas.fill

    # Blue accent bar at bottom of header
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(0, header_top - header_height, 595, 4)
    canvas.fill

    # "TEEEM" logo text - large and bold
    canvas.fill_color(@branding[:text_on_primary])
    canvas.font("Helvetica", size: 32, variant: :bold)
    canvas.text("TEEEM", at: [ 50, header_top - 42 ])

    # "STATEMENT" in lighter weight, tracking out
    canvas.font("Helvetica", size: 11)
    canvas.text("S T A T E M E N T", at: [ 50, header_top - 58 ])

    # Page indicator - right aligned
    canvas.font("Helvetica", size: 9)
    canvas.text("Page #{page_num} of #{total_pages}", at: [ 500, header_top - 42 ])

    # Reset colors
    canvas.fill_color("000000")

    # Get company/account details from BankAccount record
    if @bank_account_record.present?
      company_name = @bank_account_record.corporate_company&.name || @bank_account_record.account_name || account_name
      bsb = @bank_account_record.formatted_bsb || @bank_account_record.bsb || "-"
      account_number = @bank_account_record.account_number || "-"
    else
      company_name = account_name
      bsb = "-"
      account_number = "-"
    end

    # Store for summary section
    @teeem_bsb = bsb
    @teeem_account_number = account_number
    @teeem_company_name = company_name
    @teeem_start_date = start_date
    @teeem_end_date = end_date

    # Below header: Two-column layout
    # Left column: Mailing address (who statement is TO)
    # Right column: Account & period details

    content_top = header_top - header_height - 20

    # LEFT COLUMN: Mailing address block (like real bank statements)
    # Get address from corporate company if available
    address_lines = []

    if @bank_account_record&.corporate_company.present?
      corp = @bank_account_record.corporate_company
      # Use registered office address or principal place of business
      full_address = corp.registered_office_address.presence || corp.principal_place_of_business.presence
      if full_address.present?
        # Split address into lines (handle newlines or comma-separated)
        address_lines = full_address.split(/[\n,]/).map(&:strip).reject(&:blank?)
      end
    end

    # Draw address block
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text(company_name.upcase, at: [ 50, content_top ])

    y_addr = content_top - 16
    canvas.font("Helvetica", size: 10)

    # Print each address line
    address_lines.each do |line|
      canvas.text(line, at: [ 50, y_addr ])
      y_addr -= 14
    end

    # Always end with AUSTRALIA
    canvas.text("AUSTRALIA", at: [ 50, y_addr ])

    # RIGHT COLUMN: Account details box with blue left border
    box_x = 320
    box_width = 225
    box_height = 75
    box_top = content_top + 8

    # Blue left border accent
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(box_x, box_top - box_height, 3, box_height)
    canvas.fill

    # Light gray background
    canvas.fill_color("F8F9FA")
    canvas.rectangle(box_x + 3, box_top - box_height, box_width - 3, box_height)
    canvas.fill

    # Account details inside box
    y = box_top - 15
    canvas.fill_color(@branding[:secondary_color])
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("STATEMENT PERIOD", at: [ box_x + 15, y ])

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("#{format_date(start_date)} – #{format_date(end_date)}", at: [ box_x + 15, y - 14 ])

    y -= 35
    # BSB and Account in row
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 7)
    canvas.text("BSB", at: [ box_x + 15, y ])
    canvas.text("ACCOUNT", at: [ box_x + 100, y ])

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10)
    canvas.text(bsb, at: [ box_x + 15, y - 12 ])
    canvas.text(account_number, at: [ box_x + 100, y - 12 ])
  end

  def draw_teeem_summary(canvas, opening_balance, total_debits, total_credits, closing_balance)
    # Full-width summary section with modern card design
    box_x = 50
    box_y = 680
    box_width = 495
    box_height = 95

    # Card background
    canvas.fill_color("FFFFFF")
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.fill

    # Subtle border
    canvas.stroke_color("E5E7EB")
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    # Blue top accent
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(box_x, box_y, box_width, 4)
    canvas.fill

    # "Summary" title
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 12, variant: :bold)
    canvas.text("Account Summary", at: [ box_x + 20, box_y - 25 ])

    # Four columns for balance info
    col_width = 118
    y = box_y - 50

    # Column 1: Opening Balance
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Opening Balance", at: [ box_x + 20, y ])
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text(format_currency(opening_balance), at: [ box_x + 20, y - 16 ])

    # Column 2: Credits (green)
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Money In", at: [ box_x + 20 + col_width, y ])
    canvas.fill_color("059669")  # Green
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text("+#{format_currency(total_credits)}", at: [ box_x + 20 + col_width, y - 16 ])

    # Column 3: Debits (red)
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text("Money Out", at: [ box_x + 20 + col_width * 2, y ])
    canvas.fill_color("DC2626")  # Red
    canvas.font("Helvetica", size: 14, variant: :bold)
    canvas.text("-#{format_currency(total_debits)}", at: [ box_x + 20 + col_width * 2, y - 16 ])

    # Column 4: Closing Balance - highlighted with blue background
    closing_box_x = box_x + 20 + col_width * 3
    closing_box_width = col_width - 10

    # Blue highlight background for closing balance
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(closing_box_x - 10, y - 35, closing_box_width + 20, 50)
    canvas.fill

    canvas.font("Helvetica", size: 8)
    canvas.fill_color("FFFFFF")
    canvas.text("Closing Balance", at: [ closing_box_x, y ])
    canvas.font("Helvetica", size: 16, variant: :bold)
    canvas.text(format_currency(closing_balance), at: [ closing_box_x, y - 18 ])

    canvas.fill_color("000000")
  end

  def draw_teeem_transactions(canvas, transactions_with_balance, y_start, is_first_page, is_last_page)
    # Clean transaction table with subtle styling

    # Section header
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 12, variant: :bold)
    canvas.text("Transactions", at: [ 50, y_start + 5 ])

    # Blue underline accent
    canvas.fill_color(@branding[:secondary_color])
    canvas.rectangle(50, y_start - 3, 90, 2)
    canvas.fill

    # Column headers row with light gray background
    y = y_start - 25
    canvas.fill_color("F3F4F6")
    canvas.rectangle(50, y - 5, 495, 20)
    canvas.fill

    canvas.fill_color("374151")
    canvas.font("Helvetica", size: 8, variant: :bold)
    canvas.text("DATE", at: [ 60, y ])
    canvas.text("DESCRIPTION", at: [ 140, y ])
    canvas.text("DEBIT", at: [ 355, y ])
    canvas.text("CREDIT", at: [ 420, y ])
    canvas.text("BALANCE", at: [ 485, y ])

    y -= 22
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 8)

    # Opening balance row
    if is_first_page && transactions_with_balance.any?
      first_txn = transactions_with_balance.first[:txn]
      canvas.fill_color("666666")
      canvas.font("Helvetica", size: 8, variant: :italic)
      canvas.text(format_date(first_txn.transaction_date), at: [ 60, y ])
      canvas.text("Opening Balance", at: [ 140, y ])
      canvas.text(format_currency(@opening_balance), at: [ 485, y ])
      canvas.fill_color("000000")
      canvas.font("Helvetica", size: 8)
      y -= 16
    end

    # Transaction rows
    row_count = 0
    transactions_with_balance.each do |item|
      break if y < 80
      txn = item[:txn]
      balance = item[:balance]

      # Alternating row background
      if row_count.even?
        canvas.fill_color("FAFAFA")
        canvas.rectangle(50, y - 4, 495, 16)
        canvas.fill
      end

      canvas.fill_color("000000")
      canvas.text(format_date(txn.transaction_date), at: [ 60, y ])

      desc_line1, desc_line2 = build_two_line_description(txn)
      desc_line1 = desc_line1[0..38] + "..." if desc_line1.length > 40
      canvas.text(desc_line1, at: [ 140, y ])

      if desc_line2.present?
        desc_line2 = desc_line2[0..38] + "..." if desc_line2.length > 40
        canvas.font("Helvetica", size: 7)
        canvas.fill_color("666666")
        canvas.text(desc_line2, at: [ 140, y - 10 ])
        canvas.fill_color("000000")
        canvas.font("Helvetica", size: 8)
      end

      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "SPEND"
        canvas.fill_color("DC2626")
        canvas.text(format_currency(amount), at: [ 355, y ])
        canvas.fill_color("000000")
      else
        canvas.fill_color("059669")
        canvas.text(format_currency(amount), at: [ 420, y ])
        canvas.fill_color("000000")
      end

      canvas.text(format_currency(balance), at: [ 485, y ])
      y -= desc_line2.present? ? 22 : 16
      row_count += 1
    end

    # Closing balance row - bold with top border
    if is_last_page && transactions_with_balance.any?
      closing_bal = transactions_with_balance.last[:balance]
      last_txn = transactions_with_balance.last[:txn]

      y -= 4
      canvas.stroke_color("D1D5DB")
      canvas.line_width(1)
      canvas.line(50, y + 12, 545, y + 12)
      canvas.stroke

      canvas.fill_color("000000")
      canvas.font("Helvetica", size: 8, variant: :bold)
      canvas.text(format_date(last_txn.transaction_date), at: [ 60, y ])
      canvas.text("Closing Balance", at: [ 140, y ])
      canvas.font("Helvetica", size: 9, variant: :bold)
      canvas.text(format_currency(closing_bal), at: [ 485, y ])
    end
  end

  # ============================================================================
  # Date/Currency Formatting Helpers
  # ============================================================================

  # NAB date format: "1 Jul 2023"
  def format_date_nab(date)
    date.strftime("%-d %b %Y")
  end

  # Westpac date format: "dd/mm/yy"
  def format_date_westpac(date)
    date.strftime("%d/%m/%y")
  end

  # Westpac long date format: "10 January 2024"
  def format_date_westpac_long(date)
    date.strftime("%-d %B %Y")
  end

  # BOQ date format: "dd/mm/yyyy"
  def format_date_boq(date)
    date.strftime("%d/%m/%Y")
  end

  # CommBank date format: "dd Mon yyyy"
  def format_date_commbank(date)
    date.strftime("%d %b %Y")
  end

  # ANZ date format: "dd Mon yyyy"
  def format_date_anz(date)
    date.strftime("%d %b %Y")
  end

  # Generic date format using template's date_format (SSoT)
  # Falls back to bank-specific method when no template is loaded
  def format_date(date)
    return date.strftime(@template.date_format) if @template&.date_format.present?

    # Fallback to bank-specific formatting
    case @bank_type
    when :westpac then format_date_westpac(date)
    when :boq then format_date_boq(date)
    when :commbank then format_date_commbank(date)
    when :anz then format_date_anz(date)
    else format_date_nab(date) # NAB/default style
    end
  end

  # Currency with Cr/Dr suffix (NAB style)
  def format_currency_cr_dr(amount)
    amount = amount.to_f
    formatted = format_currency(amount.abs)
    suffix = amount >= 0 ? " Cr" : " Dr"
    "#{formatted}#{suffix}"
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
    canvas.text(LEGAL_DISCLAIMER, at: [ 50, 45 ])
    canvas.fill_color("000000")

    # Page number centered
    canvas.font("Helvetica", size: 8)
    canvas.text("Page #{page_num} of #{total_pages}", at: [ 270, 25 ])
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

    [ line1, line2 ]
  end

  def format_currency(amount)
    amount = amount.to_f
    formatted = format("%.2f", amount.abs)
    # Add thousand separators
    parts = formatted.split(".")
    parts[0] = parts[0].reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    "$#{parts.join('.')}"
  end

  # Right-align text at a given x position (x is the right edge)
  def draw_right_aligned_text(canvas, text, right_x, y)
    text = text.to_s
    # Approximate character width at font size 8: ~4.5 points per char
    approx_width = text.length * 4.5
    canvas.text(text, at: [ right_x - approx_width, y ])
  end

  def generate_filename
    parts = [ "Bank_Statement" ]

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
