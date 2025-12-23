# frozen_string_literal: true

# DocumentTemplatable - SSoT for template expansion across all document types
#
# This concern provides a unified template expansion system for:
# - CorporateCompanyDocument (manual uploads)
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
#   {Signed}          - Signed/Unsigned status
#   {MonthYearLong}   - Month and year (e.g., "December 2025")
#   {MonthYear}       - Month and year short (e.g., "Dec25")
#   {Period}          - Period code (e.g., "Jan25", "Feb25", "EOY")
#   {BankCode}        - Bank code (e.g., "NAB", "WBC")
#   {AccountNumber}   - Bank account number
#   {BSB}             - BSB formatted (e.g., "084-435")
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

      # Month/Year tokens (for period-based reports)
      result.gsub!('{MonthYearLong}', doc_date.strftime('%B %Y'))      # "December 2025"
      result.gsub!('{MonthYear}', doc_date.strftime('%b%y'))           # "Dec25"
    end

    # =============
    # Period Tokens
    # =============
    if context[:period].present?
      result.gsub!('{Period}', context[:period].to_s)
    elsif doc_date.present?
      # Fall back to generating period from date
      result.gsub!('{Period}', doc_date.strftime('%b%y'))
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
