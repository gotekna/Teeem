# frozen_string_literal: true

require "hexapdf"

# Generates a PDF Balance Sheet report from Xero API data.
# Format matches standard accounting report layout.
# Uploaded to SharePoint: Warehousing/Financial Reports/{CompanyName}/{FY}/
class BalanceSheetReportService
  PRIMARY_COLOR = "1A365D"    # Dark blue
  ACCENT_COLOR = "2B6CB0"     # Medium blue
  BORDER_COLOR = "CBD5E0"     # Light gray
  HEADER_BG = "EBF8FF"        # Light blue
  ASSETS_COLOR = "276749"     # Green for assets
  LIABILITIES_COLOR = "C53030" # Red for liabilities
  EQUITY_COLOR = "2B6CB0"     # Blue for equity

  def initialize(balance_sheet_report)
    @report = balance_sheet_report
    @company = @report.company
  end

  def generate
    return { success: false, error: "No report data available" } unless @report.report_data.present?

    pdf_content = build_pdf
    filename = generate_filename

    # Upload to SharePoint
    sharepoint_result = upload_to_sharepoint(pdf_content, filename)

    {
      success: true,
      pdf: pdf_content,
      filename: filename,
      sharepoint_url: sharepoint_result&.dig(:web_url),
      sharepoint_id: sharepoint_result&.dig(:id)
    }
  rescue StandardError => e
    Rails.logger.error("BalanceSheetReportService error: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    { success: false, error: e.message }
  end

  private

  def build_pdf
    doc = HexaPDF::Document.new
    page = doc.pages.add(:A4)
    canvas = page.canvas

    draw_header(canvas)
    draw_company_info(canvas)
    draw_report_content(canvas)
    draw_footer(canvas)

    output = StringIO.new
    doc.write(output)
    output.string
  end

  def draw_header(canvas)
    # Blue header bar
    canvas.fill_color(PRIMARY_COLOR)
    canvas.rectangle(0, 790, 595, 52)
    canvas.fill

    # Title
    canvas.fill_color("FFFFFF")
    canvas.font("Helvetica", size: 20, variant: :bold)
    canvas.text("Balance Sheet", at: [ 50, 815 ])

    canvas.font("Helvetica", size: 11)
    canvas.text("From Xero Accounting", at: [ 50, 798 ])

    # Date
    canvas.font("Helvetica", size: 10)
    report_date = @report.report_date || Date.current
    canvas.text("As at #{format_date(report_date)}", at: [ 420, 815 ])
    canvas.text(@report.financial_year, at: [ 420, 798 ])
  end

  def draw_company_info(canvas)
    canvas.fill_color("000000")

    # Company details box
    box_x = 50
    box_y = 760
    box_width = 250
    box_height = 60

    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Company Details", at: [ box_x + 10, box_y - 15 ])

    canvas.font("Helvetica", size: 9)
    canvas.text(@report.company_name, at: [ box_x + 10, box_y - 30 ])
    canvas.text("Code: #{@report.company_code}", at: [ box_x + 10, box_y - 42 ]) if @report.company_code.present?
    canvas.text("ABN: #{@company.abn}", at: [ box_x + 10, box_y - 54 ]) if @company&.abn.present?

    # Summary box on right
    draw_summary_box(canvas)
  end

  def draw_summary_box(canvas)
    box_x = 350
    box_y = 760
    box_width = 205
    box_height = 100

    # Light blue background
    canvas.fill_color(HEADER_BG)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.fill

    canvas.stroke_color(BORDER_COLOR)
    canvas.line_width(1)
    canvas.rectangle(box_x, box_y - box_height, box_width, box_height)
    canvas.stroke

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 10, variant: :bold)
    canvas.text("Financial Position", at: [ box_x + 10, box_y - 15 ])

    y = box_y - 35
    canvas.font("Helvetica", size: 9)

    canvas.fill_color(ASSETS_COLOR)
    canvas.text("Total Assets:", at: [ box_x + 10, y ])
    canvas.text(format_currency(@report.total_assets), at: [ box_x + 120, y ])

    y -= 14
    canvas.fill_color(LIABILITIES_COLOR)
    canvas.text("Total Liabilities:", at: [ box_x + 10, y ])
    canvas.text(format_currency(@report.total_liabilities), at: [ box_x + 120, y ])

    y -= 14
    canvas.fill_color("000000")
    canvas.line(box_x + 10, y + 5, box_x + box_width - 10, y + 5)
    canvas.stroke

    y -= 8
    canvas.font("Helvetica", size: 10, variant: :bold)
    net_assets = @report.net_assets || (@report.total_assets.to_f - @report.total_liabilities.to_f)

    canvas.fill_color(EQUITY_COLOR)
    canvas.text("Net Assets:", at: [ box_x + 10, y ])
    canvas.text(format_currency(net_assets), at: [ box_x + 120, y ])

    y -= 16
    canvas.fill_color("666666")
    canvas.font("Helvetica", size: 7)
    canvas.text("(Equals Total Equity)", at: [ box_x + 10, y ])
    canvas.fill_color("000000")
  end

  def draw_report_content(canvas)
    y_start = 640

    # Parse report data from Xero
    report_data = @report.report_data
    return unless report_data.is_a?(Hash) && report_data["Rows"].present?

    canvas.font("Helvetica", size: 11, variant: :bold)
    canvas.text("Detailed Breakdown", at: [ 50, y_start ])

    y = y_start - 25

    # Draw table headers
    canvas.fill_color(HEADER_BG)
    canvas.rectangle(50, y - 5, 505, 18)
    canvas.fill

    canvas.fill_color("000000")
    canvas.font("Helvetica", size: 9, variant: :bold)
    canvas.text("Account", at: [ 55, y ])
    canvas.text("Amount", at: [ 480, y ])

    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, y - 8, 555, y - 8)
    canvas.stroke

    y -= 25
    canvas.font("Helvetica", size: 9)

    # Process Xero report rows
    report_data["Rows"].each do |section|
      next unless section["RowType"] == "Section"

      title = section["Title"]
      next if title.blank?

      # Section header with color coding
      canvas.font("Helvetica", size: 9, variant: :bold)
      section_color = case title.downcase
      when /asset/ then ASSETS_COLOR
      when /liabilit/ then LIABILITIES_COLOR
      when /equity/ then EQUITY_COLOR
      else ACCENT_COLOR
      end
      canvas.fill_color(section_color)
      canvas.text(title.upcase, at: [ 55, y ])
      canvas.fill_color("000000")
      y -= 15

      canvas.font("Helvetica", size: 8)

      # Process rows in section
      section["Rows"]&.each do |row|
        break if y < 80

        case row["RowType"]
        when "Row"
          cells = row["Cells"] || []
          account_name = cells[0]&.dig("Value") || ""
          amount = cells[1]&.dig("Value")&.to_f || 0

          canvas.text("  #{account_name}", at: [ 55, y ])
          canvas.text(format_currency(amount), at: [ 480, y ])
          y -= 12

        when "SummaryRow"
          cells = row["Cells"] || []
          label = cells[0]&.dig("Value") || "Total"
          amount = cells[1]&.dig("Value")&.to_f || 0

          canvas.font("Helvetica", size: 9, variant: :bold)
          canvas.text(label, at: [ 55, y ])
          canvas.text(format_currency(amount), at: [ 480, y ])
          canvas.font("Helvetica", size: 8)
          y -= 15
        end
      end

      y -= 10 # Space between sections
    end

    # Draw accounting equation at bottom
    if y > 100
      y -= 20
      canvas.stroke_color(PRIMARY_COLOR)
      canvas.line_width(2)
      canvas.line(50, y, 555, y)
      canvas.stroke

      y -= 20
      canvas.font("Helvetica", size: 9)
      canvas.fill_color("666666")
      canvas.text("Accounting Equation: Assets = Liabilities + Equity", at: [ 55, y ])

      y -= 12
      assets = @report.total_assets.to_f
      liabilities = @report.total_liabilities.to_f
      net = @report.net_assets.to_f
      canvas.text("#{format_currency(assets)} = #{format_currency(liabilities)} + #{format_currency(net)}", at: [ 55, y ])
      canvas.fill_color("000000")
    end
  end

  def draw_footer(canvas)
    # Bottom separator line
    canvas.stroke_color(BORDER_COLOR)
    canvas.line(50, 60, 545, 60)
    canvas.stroke

    # Disclaimer
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    disclaimer = "This report was generated from Xero accounting software. " \
                 "For official records, refer to your audited financial statements."
    canvas.text(disclaimer, at: [ 50, 45 ])

    # Generated timestamp
    canvas.text("Generated: #{Time.current.strftime('%d %b %Y at %H:%M')}", at: [ 50, 30 ])
    canvas.fill_color("000000")
  end

  def upload_to_sharepoint(content, filename)
    credential = OrganizationSharePointCredential.active_credential
    unless credential.present?
      Rails.logger.warn("[BalanceSheetReportService] No SharePoint credentials found - skipping upload")
      return nil
    end

    graph_client = MicrosoftGraphClient.new(credential)

    # Get or create Warehousing folder at root
    warehousing_folder = graph_client.find_folder_in_drive_root("Warehousing")
    unless warehousing_folder
      warehousing_folder = graph_client.create_folder("Warehousing")
      Rails.logger.info("[BalanceSheetReportService] Created SharePoint folder: Warehousing")
    end

    # Get or create Financial Reports subfolder
    financial_folder = graph_client.get_or_create_subfolder(
      warehousing_folder["id"] || warehousing_folder[:id],
      "Financial Reports"
    )

    # Get or create company subfolder
    # SSoT: Use centralized SharePoint path sanitization
    company_name = SharePoint::FilenameSanitizer.sanitize_path_segment(@report.company_name)
    company_folder = graph_client.get_or_create_subfolder(
      financial_folder[:id] || financial_folder["id"],
      company_name
    )

    # Get or create FY subfolder
    fy_folder = graph_client.get_or_create_subfolder(
      company_folder[:id] || company_folder["id"],
      @report.financial_year
    )

    # Upload the file
    upload_result = graph_client.upload_file_content(
      fy_folder[:id] || fy_folder["id"],
      filename,
      content
    )

    Rails.logger.info("[BalanceSheetReportService] Uploaded to SharePoint: Warehousing/Financial Reports/#{company_name}/#{@report.financial_year}/#{filename}")
    upload_result
  rescue MicrosoftGraphClient::AuthenticationError => e
    Rails.logger.error("[BalanceSheetReportService] SharePoint auth error: #{e.message}")
    nil
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("[BalanceSheetReportService] SharePoint API error: #{e.message}")
    nil
  rescue StandardError => e
    Rails.logger.error("[BalanceSheetReportService] SharePoint upload error: #{e.message}")
    nil
  end

  def generate_filename
    code = @report.company_code.presence || "XX"
    fy_short = @report.financial_year.to_s.gsub(/FY?(\d{4})/) { "FY#{$1[-2..]}" }
    "#{code} Balance Sheet #{fy_short}.pdf"
  end

  def format_date(date)
    return "" unless date
    date.strftime("%-d %b %Y")
  end

  def format_currency(amount)
    amount = amount.to_f
    sign = amount < 0 ? "-" : ""
    formatted = format("%.2f", amount.abs)
    parts = formatted.split(".")
    parts[0] = parts[0].reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    "#{sign}$#{parts.join('.')}"
  end
end
