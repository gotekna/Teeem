# frozen_string_literal: true

# DocumentTemplatable - SSoT for template expansion across all document types
#
# This concern provides a unified template expansion system for:
# - WarehouseDocument (universal document storage)
# - ProfitLossReport (auto-generated)
# - BalanceSheetReport (auto-generated)
# - BankStatementReport (auto-generated)
#
# Usage:
#   class MyReport < ApplicationRecord
#     include DocumentTemplatable
#
#     def template_context
#       { company_code: "ABC", period_end: Date.new(2025, 12, 31), ... }
#     end
#   end
#
# Available Tokens:
#   {CompanyCode}     - Company code (e.g., "THSI")
#   {CompanyName}     - Company name
#   {DocTypeName}     - Document type name (e.g., "Profit and Loss")
#   {DocTypeCode}     - Document type abbreviation (e.g., "P&L")
#   {FY}              - Financial year short (e.g., "FY26")
#   {Year}            - Year 2-digit (e.g., "26")
#   {YearLong}        - Year 4-digit (e.g., "2026")
#   {Date}            - Document date formatted (e.g., "31-12-2025")
#   {Day}             - Day of month (e.g., "09")
#   {DayLong}         - Day with suffix (e.g., "9th")
#   {DDMMYYYY}        - Date AU short (e.g., "09-10-2025")
#   {DateAU}          - Date AU long (e.g., "9 October 2025")
#   {Signed}          - Signed/Unsigned status
#   {MonthYearLong}   - Month and year (e.g., "December 2025")
#   {MonthYear}       - Month and year short (e.g., "Dec25")
#   {Period}          - Period code (e.g., "Jan25", "Feb25", "EOY")
#   {PeriodLong}      - Period long (e.g., "January 2025")
#   {BankCode}        - Bank code (e.g., "NAB", "WBC")
#   {AccountNumber}   - Bank account number
#   {BSB}             - BSB formatted (e.g., "084-435")
#   {AssetCode}       - Asset code (e.g., "PROP1")
#   {AssetName}       - Asset name (e.g., "123 Main Street")
#   {CompanyGroup}    - Company group name
#   {LoanID}          - Loan ID (e.g., "L001")
#   {LoanName}        - Loan name
#   {LenderCode}      - Lender code
#   {LenderName}      - Lender name
#   {PersonCode}      - Person code (e.g., "RH")
#   {PersonName}      - Person name
#   {JobCode}         - Job code (e.g., "EB2401")
#   {JobName}         - Job name
#   {JobTitle}        - Job title
#   {JobAddress}      - Job address
#   {LotNumber}       - Lot number
#   {StreetName}      - Street name
#   {Suburb}          - Suburb
#   {ProjectName}     - Project name
#   {Category}        - Category name
#   {CategoryCode}    - Category code
#   {BA}              - Building Approval (short)
#   {BuildingApproval} - Building Approval (long)
#   {FIA}             - Final Inspection Certificate (short)
#   {FinalInspectionCertificate} - Final Inspection Certificate (long)
#   {Occ}             - Certificate of Occupancy (short)
#   {CertificateOfOccupancy} - Certificate of Occupancy (long)
#   {Consultant}      - Consultant name
#   {Code}            - Generic code
#   {Name}            - Generic name
#   {Rev}             - Revision
#   {Variant}         - Variant
#   {Number}          - Sequential number
#   {Description}     - Description
#   {Folder}          - Folder name
#   {EX}              - Expiry short
#   {Expiry}          - Expiry long
#   {YYYYMMDD}        - ISO date (e.g., "2025-10-09")
#   {DateISO}         - ISO date alias
#
# Email Tokens (Phase 3 - Warehouse Documents):
#   {Subject}         - Email subject line (sanitized for filenames)
#   {SubjectShort}    - Email subject, first 50 chars
#   {FromName}        - Sender name
#   {FromEmail}       - Sender email
#   {ReceivedDate}    - Date email was received (e.g., "17-01-2026")
#
module DocumentTemplatable
  extend ActiveSupport::Concern

  # Expand a template string with document values
  # @param template [String] The template with {Token} placeholders
  # @return [String] The expanded template
  def expand_display_template(template)
    return template if template.blank?

    result = template.dup
    context = template_context

    # =====================
    # Financial Year Tokens
    # =====================
    fy = context[:financial_year] || context[:financial_years]&.first
    if fy.present?
      # Handle both "FY26" and "2026" formats
      fy_str = fy.to_s
      fy_short = if fy_str.match?(/^FY\d{2}$/)
                   fy_str[2..3]  # "FY26" -> "26"
                 elsif fy_str.match?(/^FY\d{4}$/)
                   fy_str[-2..-1]  # "FY2026" -> "26"
                 elsif fy_str.length == 4
                   fy_str[-2..-1]  # "2026" -> "26"
                 elsif fy_str.length == 2
                   fy_str  # "26" -> "26"
                 else
                   fy_str
                 end
      result.gsub!('{Year}', fy_short)
      result.gsub!('{YearLong}', "20#{fy_short}")
      result.gsub!('{FY}', "FY#{fy_short}")
    end

    # ==============
    # Company Tokens
    # ==============
    result.gsub!('{CompanyCode}', context[:company_code].to_s)
    result.gsub!('{CompanyName}', context[:company_name].to_s)

    # ====================
    # Document Type Tokens
    # ====================
    result.gsub!('{DocTypeName}', context[:doc_type_name].to_s)
    result.gsub!('{DocTypeCode}', context[:doc_type_code].to_s)

    # ===========
    # Date Tokens
    # ===========
    doc_date = context[:document_date] || context[:period_end]
    if doc_date.present?
      doc_date = doc_date.to_date if doc_date.respond_to?(:to_date)
      result.gsub!('{Date}', doc_date.strftime('%d-%m-%Y'))

      # Day tokens
      day_num = doc_date.day
      day_suffix = case day_num
                   when 1, 21, 31 then "st"
                   when 2, 22 then "nd"
                   when 3, 23 then "rd"
                   else "th"
                   end
      result.gsub!('{Day}', doc_date.strftime('%d'))                   # "09"
      result.gsub!('{DayLong}', "#{day_num}#{day_suffix}")             # "9th"

      # Date format variants
      result.gsub!('{DDMMYYYY}', doc_date.strftime('%d-%m-%Y'))        # "09-10-2025"
      result.gsub!('{DateAU}', "#{day_num} #{doc_date.strftime('%B %Y')}")  # "9 October 2025"

      # Month/Year tokens (for period-based reports)
      result.gsub!('{MonthYearLong}', doc_date.strftime('%B %Y'))      # "December 2025"
      result.gsub!('{MonthYear}', doc_date.strftime('%b%y'))           # "Dec25"
    end

    # =============
    # Period Tokens
    # =============
    if context[:period].present?
      result.gsub!('{Period}', context[:period].to_s)
      # PeriodLong: expand "Jan25" to "January 2025"
      result.gsub!('{PeriodLong}', context[:period_long].to_s) if context[:period_long].present?
    end
    if doc_date.present?
      # Fall back to generating period from date
      result.gsub!('{Period}', doc_date.strftime('%b%y'))
      result.gsub!('{PeriodLong}', doc_date.strftime('%B %Y'))
    end

    # ====================
    # Bank Account Tokens
    # ====================
    result.gsub!('{BankCode}', context[:bank_code].to_s) if context[:bank_code].present?
    # Support both {AccountNum} (short) and {AccountNumber} (long)
    if context[:account_number].present?
      result.gsub!('{AccountNum}', context[:account_number].to_s)
      result.gsub!('{AccountNumber}', context[:account_number].to_s)
    end

    # BSB - format as XXX-XXX if not already formatted
    if context[:bsb].present?
      bsb = context[:bsb].to_s.gsub(/\D/, '')  # Remove non-digits
      formatted_bsb = bsb.length == 6 ? "#{bsb[0..2]}-#{bsb[3..5]}" : context[:bsb].to_s
      result.gsub!('{BSB}', formatted_bsb)
    end

    # =============
    # Signed Status
    # =============
    if context[:signed].present?
      result.gsub!('{Signed}', context[:signed].to_s)
    elsif context[:file_name].present?
      file_name = context[:file_name].to_s
      if file_name.match?(/\bUS\b|Unsigned/i)
        result.gsub!('{Signed}', 'Unsigned')
      elsif file_name.match?(/\bS\b.*\b(CTR|TTR)\b|Signed/i)
        result.gsub!('{Signed}', 'Signed')
      end
    end

    # =============
    # Asset Tokens
    # =============
    result.gsub!('{AssetCode}', context[:asset_code].to_s) if context[:asset_code].present?
    result.gsub!('{AssetName}', context[:asset_name].to_s) if context[:asset_name].present?

    # =============
    # Company Group
    # =============
    result.gsub!('{CompanyGroup}', context[:company_group].to_s) if context[:company_group].present?

    # =============
    # Loan Tokens
    # =============
    result.gsub!('{LoanID}', context[:loan_id].to_s) if context[:loan_id].present?
    result.gsub!('{LoanName}', context[:loan_name].to_s) if context[:loan_name].present?
    result.gsub!('{LenderCode}', context[:lender_code].to_s) if context[:lender_code].present?
    result.gsub!('{LenderName}', context[:lender_name].to_s) if context[:lender_name].present?

    # =============
    # Person Tokens
    # =============
    result.gsub!('{PersonCode}', context[:person_code].to_s) if context[:person_code].present?
    result.gsub!('{PersonName}', context[:person_name].to_s) if context[:person_name].present?

    # =============
    # Job Tokens
    # =============
    result.gsub!('{JobCode}', context[:job_code].to_s) if context[:job_code].present?
    result.gsub!('{JobName}', context[:job_name].to_s) if context[:job_name].present?
    result.gsub!('{JobTitle}', context[:job_title].to_s) if context[:job_title].present?
    result.gsub!('{JobAddress}', context[:job_address].to_s) if context[:job_address].present?
    result.gsub!('{LotNumber}', context[:lot_number].to_s) if context[:lot_number].present?
    result.gsub!('{StreetName}', context[:street_name].to_s) if context[:street_name].present?
    result.gsub!('{Suburb}', context[:suburb].to_s) if context[:suburb].present?
    result.gsub!('{ProjectName}', context[:project_name].to_s) if context[:project_name].present?

    # =============
    # Category Tokens
    # =============
    result.gsub!('{Category}', context[:category].to_s) if context[:category].present?
    result.gsub!('{CategoryCode}', context[:category_code].to_s) if context[:category_code].present?
    result.gsub!('{Consultant}', context[:consultant].to_s) if context[:consultant].present?

    # =============
    # Certificate Type Tokens (static text placeholders)
    # =============
    result.gsub!('{BA}', 'BA')
    result.gsub!('{BuildingApproval}', 'Building Approval')
    result.gsub!('{FIA}', 'FIA')
    result.gsub!('{FinalInspectionCertificate}', 'Final Inspection Certificate')
    result.gsub!('{Occ}', 'Occ')
    result.gsub!('{CertificateOfOccupancy}', 'Certificate of Occupancy')

    # =============
    # Generic Tokens
    # =============
    result.gsub!('{Code}', context[:code].to_s) if context[:code].present?
    result.gsub!('{Name}', context[:name].to_s) if context[:name].present?
    result.gsub!('{Rev}', context[:rev].to_s) if context[:rev].present?
    result.gsub!('{Variant}', context[:variant].to_s) if context[:variant].present?
    result.gsub!('{Number}', context[:number].to_s) if context[:number].present?
    result.gsub!('{Description}', context[:description].to_s) if context[:description].present?
    result.gsub!('{Folder}', context[:folder].to_s) if context[:folder].present?

    # =============
    # Expiry Tokens
    # =============
    if context[:expiry_date].present?
      exp_date = context[:expiry_date].to_date
      result.gsub!('{EX}', "EX #{exp_date.strftime('%d/%m/%y')}")
      result.gsub!('{Expiry}', "Expiry #{exp_date.day} #{exp_date.strftime('%B %Y')}")
    end

    # =============
    # ISO Date Tokens
    # =============
    if doc_date.present?
      result.gsub!('{YYYYMMDD}', doc_date.strftime('%Y-%m-%d'))
      result.gsub!('{DateISO}', doc_date.strftime('%Y-%m-%d'))
    end

    # =============
    # Email Tokens (Phase 3 - Warehouse Documents)
    # =============
    if context[:subject].present?
      # Sanitize subject for use in filenames (remove : / \ * ? " < > |)
      sanitized_subject = context[:subject].to_s.gsub(/[:\/*?"<>|\\]/, ' ').gsub(/\s+/, ' ').strip
      result.gsub!('{Subject}', sanitized_subject)
      # Short version - first 50 chars
      result.gsub!('{SubjectShort}', sanitized_subject[0..49].to_s.strip)
    end
    result.gsub!('{FromName}', context[:from_name].to_s) if context[:from_name].present?
    result.gsub!('{FromEmail}', context[:from_email].to_s) if context[:from_email].present?
    if context[:received_date].present?
      recv_date = context[:received_date].to_date rescue nil
      result.gsub!('{ReceivedDate}', recv_date&.strftime('%d-%m-%Y').to_s) if recv_date
    end

    # ================================
    # Clean up unreplaced tokens
    # ================================
    result.gsub!(/\s*\{[^}]+\}\s*/, ' ')

    # Clean up extra spaces
    result.gsub(/\s+/, ' ').strip
  end

  # Generate filename from template
  # @param template [String] The filename template
  # @return [String] The expanded filename
  def expand_filename_template(template)
    return nil if template.blank?

    result = expand_display_template(template)

    # Ensure .pdf extension if not present
    result = "#{result}.pdf" unless result.match?(/\.\w+$/)

    result
  end

  # Override in including class to provide template values
  # @return [Hash] Context values for template expansion
  def template_context
    raise NotImplementedError, "#{self.class.name} must implement #template_context"
  end
end
