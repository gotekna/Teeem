# frozen_string_literal: true

require "hexapdf"

# Generates PDF financial reports (P&L, Balance Sheet) from Xero data
# SSoT: Single service for all financial report types
class FinancialReportService
  include StorageUploadable

  COLORS = {
    primary: "1A365D", accent: "2B6CB0", border: "CBD5E0", header_bg: "EBF8FF",
    positive: "276749", negative: "C53030", equity: "2B6CB0"
  }.freeze

  REPORT_CONFIG = {
    "ProfitLossReport" => { title: "Profit & Loss Statement", code: "PL" },
    "BalanceSheetReport" => { title: "Balance Sheet", code: "BS" }
  }.freeze

  def initialize(report)
    @report = report
    @company = report.corporate_company
    @config = REPORT_CONFIG[report.class.name] || { title: "Financial Report", code: "FR" }
  end

  def generate
    return { success: false, error: "No report data" } unless @report.report_data.present?

    pdf_content = build_pdf
    filename = @report.generate_file_name || generate_filename
    folder_path = "/Warehousing/Financial Reports/#{sanitize_storage_path(@report.company_name)}/#{@report.financial_year}"

    result = upload_to_storage_path(folder_path, pdf_content, filename, content_type: "application/pdf")

    { success: true, pdf: pdf_content, filename: filename, storage_url: result[:url], storage_id: result[:id] }
  rescue StandardError => e
    Rails.logger.error("FinancialReportService error: #{e.message}")
    { success: false, error: e.message }
  end

  private

  def build_pdf
    doc = HexaPDF::Document.new
    canvas = doc.pages.add(:A4).canvas
    draw_header(canvas)
    draw_company_info(canvas)
    draw_summary_box(canvas)
    draw_report_content(canvas)
    draw_footer(canvas)
    output = StringIO.new
    doc.write(output)
    output.string
  end

  def draw_header(canvas)
    canvas.fill_color(COLORS[:primary])
    canvas.rectangle(0, 790, 595, 52).fill
    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 20, variant: :bold)
    canvas.text(@config[:title], at: [50, 815])
    canvas.font("Helvetica", size: 11)
    canvas.text("From Xero Accounting", at: [50, 798])
    canvas.font("Helvetica", size: 10)
    canvas.text(header_date_text, at: [420, 815])
    canvas.text(@report.financial_year, at: [420, 798])
  end

  def header_date_text
    if @report.respond_to?(:period_start) && @report.period_start
      "#{format_date(@report.period_start)} to #{format_date(@report.period_end)}"
    else
      "As at #{format_date(@report.report_date || Date.current)}"
    end
  end

  def draw_company_info(canvas)
    canvas.fill_color("000000")
    draw_box(canvas, 50, 760, 250, 60) do
      canvas.font("Helvetica", size: 10, variant: :bold)
      canvas.text("Company Details", at: [60, 745])
      canvas.font("Helvetica", size: 9)
      canvas.text(@report.company_name, at: [60, 730])
      canvas.text("Code: #{@report.company_code}", at: [60, 718]) if @report.company_code.present?
      canvas.text("ABN: #{@company.abn}", at: [60, 706]) if @company&.abn.present?
    end
  end

  def draw_summary_box(canvas)
    draw_box(canvas, 350, 760, 205, 100, fill: COLORS[:header_bg]) do
      canvas.fill_color("000000")
      canvas.font("Helvetica", size: 10, variant: :bold)
      canvas.text("Financial Summary", at: [360, 745])

      if @report.is_a?(ProfitLossReport)
        draw_pl_summary(canvas)
      else
        draw_bs_summary(canvas)
      end
    end
  end

  def draw_pl_summary(canvas)
    y = 725
    canvas.font("Helvetica", size: 9)
    [["Total Revenue:", @report.total_revenue], ["Total Expenses:", @report.total_expenses]].each do |label, val|
      canvas.text(label, at: [360, y])
      canvas.text(format_currency(val), at: [470, y])
      y -= 14
    end
    canvas.line(360, y + 5, 545, y + 5).stroke
    y -= 8
    canvas.font("Helvetica", size: 10, variant: :bold)
    net = @report.net_profit || (@report.total_revenue.to_f - @report.total_expenses.to_f)
    canvas.fill_color(net >= 0 ? COLORS[:positive] : COLORS[:negative])
    canvas.text("Net Profit:", at: [360, y])
    canvas.text(format_currency(net), at: [470, y])
  end

  def draw_bs_summary(canvas)
    y = 725
    canvas.font("Helvetica", size: 9)
    canvas.fill_color(COLORS[:positive])
    canvas.text("Total Assets:", at: [360, y])
    canvas.text(format_currency(@report.total_assets), at: [470, y])
    y -= 14
    canvas.fill_color(COLORS[:negative])
    canvas.text("Total Liabilities:", at: [360, y])
    canvas.text(format_currency(@report.total_liabilities), at: [470, y])
    y -= 14
    canvas.fill_color("000000")
    canvas.line(360, y + 5, 545, y + 5).stroke
    y -= 8
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.fill_color(COLORS[:equity])
    net = @report.net_assets || (@report.total_assets.to_f - @report.total_liabilities.to_f)
    canvas.text("Net Assets:", at: [360, y])
    canvas.text(format_currency(net), at: [470, y])
  end

  def draw_report_content(canvas)
    report_data = @report.report_data
    return unless report_data.is_a?(Hash) && report_data["Rows"].present?

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("Detailed Breakdown", at: [50, 640])

    y = 615
    draw_table_header(canvas, y)
    y -= 25

    report_data["Rows"].each do |section|
      next unless section["RowType"] == "Section" && section["Title"].present?
      y = draw_section(canvas, section, y)
      break if y < 80
    end
  end

  def draw_table_header(canvas, y)
    canvas.fill_color(COLORS[:header_bg])
    canvas.rectangle(50, y - 5, 505, 18).fill
    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Account", at: [55, y])
    canvas.text("Amount", at: [480, y])
    canvas.stroke_color(COLORS[:border])
    canvas.line(50, y - 8, 555, y - 8).stroke
  end

  def draw_section(canvas, section, y)
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.fill_color(section_color(section["Title"]))
    canvas.text(section["Title"].upcase, at: [55, y])
    canvas.fill_color("000000")
    y -= 15

    canvas.font("Helvetica", size: 8)
    section["Rows"]&.each do |row|
      return y if y < 80
      y = draw_row(canvas, row, y)
    end
    y - 10
  end

  def section_color(title)
    case title.to_s.downcase
    when /asset/ then COLORS[:positive]
    when /liabilit/ then COLORS[:negative]
    when /equity/ then COLORS[:equity]
    else COLORS[:accent]
    end
  end

  def draw_row(canvas, row, y)
    cells = row["Cells"] || []
    case row["RowType"]
    when "Row"
      canvas.font("Helvetica", size: 8)
      canvas.text("  #{cells[0]&.dig('Value')}", at: [55, y])
      canvas.text(format_currency(cells[1]&.dig("Value").to_f), at: [480, y])
      y - 12
    when "SummaryRow"
      canvas.font("Helvetica", size: 9, variant: :bold)
      canvas.text(cells[0]&.dig("Value") || "Total", at: [55, y])
      canvas.text(format_currency(cells[1]&.dig("Value").to_f), at: [480, y])
      y - 15
    else
      y
    end
  end

  def draw_footer(canvas)
    canvas.stroke_color(COLORS[:border])
    canvas.line(50, 60, 545, 60).stroke
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    canvas.text("Generated from Xero. For official records, refer to audited statements.", at: [50, 45])
    canvas.text("Generated: #{Time.current.strftime('%d %b %Y at %H:%M')}", at: [50, 30])
  end

  def draw_box(canvas, x, y, w, h, fill: nil)
    if fill
      canvas.fill_color(fill)
      canvas.rectangle(x, y - h, w, h).fill
    end
    canvas.stroke_color(COLORS[:border])
    canvas.line_width(1)
    canvas.rectangle(x, y - h, w, h).stroke
    yield if block_given?
  end

  def generate_filename
    code = @report.company_code.presence || "XX"
    fy = @report.financial_year.to_s.gsub(/FY?(\d{4})/) { "FY#{$1[-2..]}" }
    period = @report.period.present? ? " #{@report.period}" : ""
    "#{code} #{@config[:code]}#{period} #{fy}.pdf"
  end

  def format_date(date) = date&.strftime("%-d %b %Y") || ""
  def format_currency(amt)
    amt = amt.to_f
    parts = format("%.2f", amt.abs).split(".")
    parts[0] = parts[0].reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    "#{amt < 0 ? '-' : ''}$#{parts.join('.')}"
  end
end
