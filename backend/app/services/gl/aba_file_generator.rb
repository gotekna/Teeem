# frozen_string_literal: true

module Gl
  # Generates ABA (Australian Bankers Association) files for batch payments
  # Specification: https://www.cemtexaba.com/aba-format/cemtex-aba-file-format-details
  class AbaFileGenerator
    RECORD_TYPE_DESCRIPTIVE = "0"
    RECORD_TYPE_DETAIL = "1"
    RECORD_TYPE_TOTAL = "7"

    TRANSACTION_CODE_CREDIT = "50" # Externally initiated credit

    def initialize(payment_batch)
      @batch = payment_batch
      @company = payment_batch.corporate_company
      @settings = CorporateCompanySetting.first_or_create
    end

    def generate
      lines = []
      lines << descriptive_record
      @batch.items.each { |item| lines << detail_record(item) }
      lines << total_record
      lines.join("\n")
    end

    private

    # Record Type 0 - Descriptive Record
    def descriptive_record
      [
        RECORD_TYPE_DESCRIPTIVE,
        " " * 17,                                    # Blanks (17)
        format_sequence_number(1),                   # Reel Sequence Number (2)
        format_bank_name,                            # Name of financial institution (3)
        " " * 7,                                     # Blanks (7)
        format_user_name,                            # User preferred name (26)
        format_user_id,                              # User ID number (6)
        format_description,                          # Description (12)
        format_date(@batch.payment_date),            # Date (6)
        " " * 40                                     # Blanks (40)
      ].join
    end

    # Record Type 1 - Detail Record
    def detail_record(item)
      [
        RECORD_TYPE_DETAIL,
        item.formatted_bsb,                          # BSB (7 with hyphen at pos 4, or 6)
        item.formatted_account_number,               # Account Number (9)
        " ",                                         # Indicator (1)
        TRANSACTION_CODE_CREDIT,                     # Transaction Code (2)
        format_amount(item.amount),                  # Amount (10)
        item.formatted_account_name,                 # Title of Account (32)
        format_lodgement_reference(item),            # Lodgement Reference (18)
        format_bsb(bank_bsb),                        # Trace BSB (7)
        format_account_number(bank_account),         # Trace Account (9)
        format_remitter_name,                        # Name of Remitter (16)
        format_withholding_tax                       # Withholding Tax (8)
      ].join
    end

    # Record Type 7 - File Total Record
    def total_record
      credit_total = @batch.items.sum(:amount)
      debit_total = 0 # We only do credits in supplier payments

      [
        RECORD_TYPE_TOTAL,
        "999-999",                                   # BSB (7)
        " " * 12,                                    # Blanks (12)
        format_amount(debit_total + credit_total),   # Net Total (10)
        format_amount(credit_total),                 # Credit Total (10)
        format_amount(debit_total),                  # Debit Total (10)
        " " * 24,                                    # Blanks (24)
        format_record_count,                         # Record Count (6)
        " " * 40                                     # Blanks (40)
      ].join
    end

    def format_sequence_number(num)
      num.to_s.rjust(2, "0")
    end

    def format_bank_name
      (@settings.bank_name || "BANK").upcase.ljust(3).first(3)
    end

    def format_user_name
      (@company.name || "COMPANY").upcase.ljust(26).first(26)
    end

    def format_user_id
      # Use ABN or a configured user ID
      (@settings.aba_user_id || @company.abn&.gsub(/\s/, "") || "000000").rjust(6, "0").first(6)
    end

    def format_description
      "PAYMENTS".ljust(12).first(12)
    end

    def format_date(date)
      date.strftime("%d%m%y")
    end

    def format_amount(amount)
      # Amount in cents, 10 digits, right-aligned, zero-filled
      ((amount * 100).to_i.abs).to_s.rjust(10, "0")
    end

    def format_lodgement_reference(item)
      ref = item.reference || item.invoice&.reference || "PAYMENT"
      ref.upcase.gsub(/[^A-Z0-9 ]/, "").ljust(18).first(18)
    end

    def format_bsb(bsb)
      return "000-000" unless bsb

      clean = bsb.gsub("-", "")
      "#{clean[0..2]}-#{clean[3..5]}"
    end

    def format_account_number(account)
      return " " * 9 unless account

      account.gsub(/\D/, "").rjust(9, " ").first(9)
    end

    def format_remitter_name
      (@company.name || "COMPANY").upcase.gsub(/[^A-Z0-9 ]/, "").ljust(16).first(16)
    end

    def format_withholding_tax
      "00000000"
    end

    def format_record_count
      @batch.items.count.to_s.rjust(6, "0")
    end

    def bank_bsb
      @settings.bank_bsb || @batch.bank_account&.bsb
    end

    def bank_account
      @settings.bank_account_number || @batch.bank_account&.account_number
    end
  end
end
