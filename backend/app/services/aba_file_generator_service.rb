# frozen_string_literal: true

# ABA (Australian Bankers' Association) Direct Entry File Generator
# Generates .aba files compliant with the Cemtext/DE format for batch payments
#
# ABA Format Specification:
# - Record Type 0: Descriptive record (header)
# - Record Type 1: Detail record (individual payments)
# - Record Type 7: File total record (footer)
# - All records are exactly 120 characters
# - Line endings: CR+LF
#
class AbaFileGeneratorService
  RECORD_LENGTH = 120
  BSB_FORMAT = /\A\d{3}-?\d{3}\z/
  ACCOUNT_MAX_LENGTH = 9
  ACCOUNT_NAME_MAX = 32
  LODGEMENT_REF_MAX = 18
  REMITTER_NAME_MAX = 16

  # Transaction codes
  TRANSACTION_CODES = {
    externally_initiated_debit: "13",
    externally_initiated_credit: "50",
    aust_govt_security_interest: "51",
    family_allowance: "52",
    pay: "53",                    # Most common - credit to supplier
    pension: "54",
    allotment: "55",
    dividend: "56",
    debenture_note_interest: "57"
  }.freeze

  # Indicator types
  INDICATOR_NEW_OR_VARIED = "N"
  INDICATOR_DIVIDEND = "D"
  INDICATOR_INTEREST = "Y"
  INDICATOR_SALARY_SUPER = "W"
  INDICATOR_TAX_WITHHELD = "X"
  INDICATOR_SELF_BALANCED = " "

  class ValidationError < StandardError; end
  class GenerationError < StandardError; end

  attr_reader :batch, :errors

  def initialize(batch)
    @batch = batch
    @errors = []
  end

  # Main entry point - generates ABA file content
  def generate!
    validate_batch!

    content = []
    content << generate_descriptive_record

    @batch.bill_payments.each_with_index do |item, index|
      next if item.status == "failed"

      content << generate_detail_record(item, index + 1)
    end

    content << generate_file_total_record

    aba_content = content.join("\r\n") + "\r\n"

    # Increment sequence number
    sequence = @batch.bank_account.next_aba_sequence
    @batch.bank_account.update!(next_aba_sequence: sequence + 1)

    {
      success: true,
      content: aba_content,
      filename: generate_filename(sequence),
      sequence: sequence.to_s.rjust(2, "0")
    }
  rescue ValidationError => e
    { success: false, error: e.message, errors: @errors }
  rescue StandardError => e
    Rails.logger.error "[AbaFileGenerator] Generation failed: #{e.message}"
    raise GenerationError, "ABA file generation failed: #{e.message}"
  end

  private

  def validate_batch!
    @errors = []

    # Validate batch has items
    valid_payments = @batch.bill_payments.where.not(status: "failed")
    if valid_payments.empty?
      @errors << "Batch has no valid payment items"
    end

    # Validate source bank account
    bank_account = @batch.bank_account
    unless bank_account.present?
      @errors << "No source bank account specified"
    else
      unless bank_account.is_ap_enabled
        @errors << "Bank account is not enabled for AP payments"
      end
      unless valid_bsb?(bank_account.bsb)
        @errors << "Source bank account has invalid BSB: #{bank_account.bsb}"
      end
      unless valid_account_number?(bank_account.account_number)
        @errors << "Source bank account has invalid account number"
      end
      if bank_account.aba_user_name.blank?
        @errors << "Bank account missing ABA user name"
      end
      if bank_account.aba_user_number.blank?
        @errors << "Bank account missing ABA user number"
      end
    end

    # Validate payment date
    if @batch.payment_date.blank?
      @errors << "Payment date is required"
    end

    # Validate each item
    valid_payments.each do |item|
      validate_payment_item(item)
    end

    if @errors.any?
      raise ValidationError, "Validation failed: #{@errors.join("; ")}"
    end
  end

  def validate_payment_item(item)
    unless valid_bsb?(item.payee_bsb)
      @errors << "Payment ##{item.id}: Invalid payee BSB '#{item.payee_bsb}'"
    end

    unless valid_account_number?(item.payee_account_number)
      @errors << "Payment ##{item.id}: Invalid payee account number"
    end

    if item.payee_name.blank?
      @errors << "Payment ##{item.id}: Missing payee name"
    end

    if item.amount <= 0
      @errors << "Payment ##{item.id}: Amount must be positive"
    end

    if item.amount > 99_999_999.99
      @errors << "Payment ##{item.id}: Amount exceeds maximum ($99,999,999.99)"
    end
  end

  # Record Type 0: Descriptive Record (file header)
  def generate_descriptive_record
    bank_account = @batch.bank_account
    company = @batch.corporate_company

    record = ""
    record += "0"                                              # Record type (1)
    record += " " * 17                                         # Blank (17)
    record += @batch.bank_account.next_aba_sequence.to_s.rjust(2, "0") # Reel sequence (2)
    record += bank_code_for_aba(bank_account.bank_code)        # Bank code (3)
    record += " " * 7                                          # Blank (7)
    record += format_string(bank_account.aba_user_name, 26)    # User name (26)
    record += format_string(bank_account.aba_user_number, 6, numeric: true) # User ID (6)
    record += format_string(@batch.processing_description || "PAYMENTS", 12) # Description (12)
    record += @batch.payment_date.strftime("%d%m%y")           # Processing date (6)
    record += " " * 40                                         # Blank (40)

    pad_record(record)
  end

  # Record Type 1: Detail Record (individual payments)
  def generate_detail_record(item, line_number)
    record = ""
    record += "1"                                              # Record type (1)
    record += format_bsb(item.payee_bsb)                       # BSB of payee (7)
    record += format_account(item.payee_account_number)        # Account number (9)
    record += item.indicator || INDICATOR_SELF_BALANCED        # Indicator (1)
    record += TRANSACTION_CODES[:pay]                          # Transaction code (2)
    record += format_amount(item.amount)                       # Amount in cents (10)
    record += format_string(item.payee_name, 32)               # Account name (32)
    record += format_string(item.payment_reference, 18)        # Lodgement reference (18)
    record += format_bsb(@batch.bank_account.bsb)              # Trace BSB (7)
    record += format_account(@batch.bank_account.account_number) # Trace account (9)
    record += format_string(remitter_name, 16)                 # Remitter name (16)
    record += format_amount(0)                                 # Withholding tax (8)

    pad_record(record)
  end

  # Record Type 7: File Total Record
  def generate_file_total_record
    valid_payments = @batch.bill_payments.where.not(status: "failed")

    # Calculate totals in cents
    credit_total_cents = valid_payments.sum { |p| (p.amount * 100).to_i }
    debit_total_cents = credit_total_cents  # Self-balancing
    net_total_cents = 0  # For self-balanced files

    record = ""
    record += "7"                                              # Record type (1)
    record += "999-999"                                        # BSB format (7)
    record += " " * 12                                         # Blank (12)
    record += net_total_cents.to_s.rjust(10, "0")              # Net total (10)
    record += credit_total_cents.to_s.rjust(10, "0")           # Credit total (10)
    record += debit_total_cents.to_s.rjust(10, "0")            # Debit total (10)
    record += " " * 24                                         # Blank (24)
    record += valid_payments.count.to_s.rjust(6, "0")          # Record count (6)
    record += " " * 40                                         # Blank (40)

    pad_record(record)
  end

  # Helper methods
  def valid_bsb?(bsb)
    return false if bsb.blank?

    normalized = bsb.to_s.gsub(/[^0-9]/, "")
    normalized.length == 6
  end

  def valid_account_number?(account)
    return false if account.blank?

    normalized = account.to_s.gsub(/[^0-9]/, "")
    normalized.length >= 1 && normalized.length <= ACCOUNT_MAX_LENGTH
  end

  def format_bsb(bsb)
    normalized = bsb.to_s.gsub(/[^0-9]/, "")
    "#{normalized[0..2]}-#{normalized[3..5]}"
  end

  def format_account(account)
    account.to_s.gsub(/[^0-9]/, "").rjust(9)
  end

  def format_amount(amount)
    cents = (amount.to_d * 100).to_i
    cents.to_s.rjust(10, "0")
  end

  def format_string(str, length, numeric: false)
    cleaned = str.to_s.upcase.gsub(/[^A-Z0-9 .\-&\/]/, "")
    if numeric
      cleaned = cleaned.gsub(/[^0-9]/, "").rjust(length, "0")
    end
    cleaned[0, length].ljust(length)
  end

  def pad_record(record)
    record.ljust(RECORD_LENGTH)
  end

  def bank_code_for_aba(bank_code)
    # Map internal bank codes to ABA bank codes (3 chars)
    case bank_code&.upcase
    when "NAB"    then "NAB"
    when "WBC"    then "WBC"
    when "CBA"    then "CBA"
    when "ANZ"    then "ANZ"
    when "BOQ"    then "BQL"
    when "WESTPAC" then "WBC"
    when "COMMONWEALTH" then "CBA"
    else
      # Try to extract from BSB
      bsb = @batch.bank_account.bsb.to_s.gsub(/[^0-9]/, "")
      case bsb[0..1]
      when "06", "08" then "CBA"
      when "03" then "WBC"
      when "01" then "ANZ"
      when "08" then "NAB"
      else "   "  # Unknown bank
      end
    end
  end

  def remitter_name
    @batch.corporate_company.name[0, REMITTER_NAME_MAX]
  end

  def generate_filename(sequence)
    date_str = @batch.payment_date.strftime("%Y%m%d")
    company_code = @batch.corporate_company.code || "XXX"
    "ABA_#{company_code}_#{date_str}_#{sequence.to_s.rjust(2, "0")}.aba"
  end
end
