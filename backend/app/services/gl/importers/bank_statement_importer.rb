# frozen_string_literal: true

module Gl
  module Importers
    # Bank Statement Importer
    #
    # Imports bank transactions from various file formats:
    # - CSV (with auto-detection and column mapping)
    # - OFX/QFX (Open Financial Exchange)
    # - QIF (Quicken Interchange Format)
    #
    # Usage:
    #   importer = Gl::Importers::BankStatementImporter.new(
    #     corporate,
    #     account: bank_account,
    #     provider: 'xero',
    #     tenant_id: 'abc'
    #   )
    #
    #   # Preview import (returns parsed transactions without saving)
    #   preview = importer.preview(file_path: '/path/to/statement.csv')
    #
    #   # Import with column mapping (for CSV)
    #   result = importer.import(
    #     file_path: '/path/to/statement.csv',
    #     column_mapping: { date: 0, description: 1, amount: 2 }
    #   )
    #
    class BankStatementImporter
      attr_reader :corporate, :account, :external_provider, :external_tenant_id

      # Supported file formats
      SUPPORTED_FORMATS = %w[csv ofx qfx qif].freeze

      # Common date formats to try
      DATE_FORMATS = [
        '%d/%m/%Y',      # 31/12/2024
        '%d-%m-%Y',      # 31-12-2024
        '%Y-%m-%d',      # 2024-12-31
        '%m/%d/%Y',      # 12/31/2024 (US format)
        '%d %b %Y',      # 31 Dec 2024
        '%d %B %Y',      # 31 December 2024
        '%Y%m%d'         # 20241231
      ].freeze

      def initialize(corporate, account:, provider: nil, tenant_id: nil)
        @corporate = corporate
        @account = account
        @external_provider = provider
        @external_tenant_id = tenant_id

        unless account.is_bank_account
          raise ArgumentError, "Account #{account.code} is not a bank account"
        end
      end

      # Preview import without saving
      def preview(file_path: nil, file_content: nil, format: nil)
        content = file_content || File.read(file_path)
        detected_format = format || detect_format(file_path, content)

        transactions = parse_file(content, detected_format)

        {
          format: detected_format,
          transaction_count: transactions.count,
          date_range: {
            from: transactions.map { |t| t[:date] }.min,
            to: transactions.map { |t| t[:date] }.max
          },
          totals: {
            deposits: transactions.select { |t| t[:amount].positive? }.sum { |t| t[:amount] },
            withdrawals: transactions.select { |t| t[:amount].negative? }.sum { |t| t[:amount].abs }
          },
          transactions: transactions.first(20), # Preview first 20
          column_suggestions: detected_format == 'csv' ? suggest_columns(content) : nil
        }
      end

      # Import transactions
      def import(file_path: nil, file_content: nil, format: nil, column_mapping: nil, skip_duplicates: true)
        content = file_content || File.read(file_path)
        detected_format = format || detect_format(file_path, content)

        transactions = parse_file(content, detected_format, column_mapping: column_mapping)

        imported = 0
        skipped = 0
        errors = []

        transactions.each do |tx_data|
          # Check for duplicates
          if skip_duplicates && duplicate?(tx_data)
            skipped += 1
            next
          end

          # Create journal entry for the transaction
          result = create_bank_transaction(tx_data)

          if result[:success]
            imported += 1
          else
            errors << { transaction: tx_data, error: result[:error] }
          end
        end

        {
          success: errors.empty?,
          imported: imported,
          skipped: skipped,
          errors: errors,
          total_processed: transactions.count
        }
      end

      # Get import history
      def import_history
        Gl::JournalEntry
          .where(corporate: corporate)
          .where(source_type: 'bank_import')
          .where('description LIKE ?', "%#{account.code}%")
          .order(created_at: :desc)
          .limit(50)
          .group_by { |e| e.created_at.to_date }
          .transform_values { |entries| entries.count }
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # FORMAT DETECTION
      # ═══════════════════════════════════════════════════════════════

      def detect_format(file_path, content)
        # Try extension first
        if file_path
          ext = File.extname(file_path).downcase.delete('.')
          return ext if SUPPORTED_FORMATS.include?(ext)
        end

        # Detect from content
        if content.start_with?('OFXHEADER') || content.include?('<OFX>')
          'ofx'
        elsif content.start_with?('!Type:')
          'qif'
        else
          'csv'
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # PARSING
      # ═══════════════════════════════════════════════════════════════

      def parse_file(content, format, column_mapping: nil)
        case format
        when 'csv'
          parse_csv(content, column_mapping)
        when 'ofx', 'qfx'
          parse_ofx(content)
        when 'qif'
          parse_qif(content)
        else
          raise ArgumentError, "Unsupported format: #{format}"
        end
      end

      def parse_csv(content, column_mapping = nil)
        require 'csv'

        rows = CSV.parse(content, headers: true, liberal_parsing: true)
        return [] if rows.empty?

        # Use provided mapping or auto-detect
        mapping = column_mapping || auto_detect_columns(rows.headers)

        rows.map do |row|
          date = parse_date(get_column_value(row, mapping[:date]))
          next unless date

          amount = parse_amount(
            get_column_value(row, mapping[:amount]),
            get_column_value(row, mapping[:debit]),
            get_column_value(row, mapping[:credit])
          )
          next if amount.nil? || amount.zero?

          {
            date: date,
            description: get_column_value(row, mapping[:description]) || '',
            reference: get_column_value(row, mapping[:reference]),
            amount: amount,
            balance: parse_decimal(get_column_value(row, mapping[:balance])),
            raw: row.to_h
          }
        end.compact
      end

      def parse_ofx(content)
        # Simple OFX parser - handles most bank exports
        transactions = []

        # Extract transactions between <STMTTRN> tags
        content.scan(/<STMTTRN>(.*?)<\/STMTTRN>/m).each do |match|
          tx_content = match[0]

          date_match = tx_content.match(/<DTPOSTED>(\d{8})/)
          amount_match = tx_content.match(/<TRNAMT>([-\d.]+)/)
          memo_match = tx_content.match(/<MEMO>([^<]+)/) || tx_content.match(/<NAME>([^<]+)/)
          fitid_match = tx_content.match(/<FITID>([^<]+)/)

          next unless date_match && amount_match

          transactions << {
            date: Date.strptime(date_match[1], '%Y%m%d'),
            description: memo_match ? memo_match[1].strip : '',
            reference: fitid_match ? fitid_match[1].strip : nil,
            amount: amount_match[1].to_d,
            balance: nil
          }
        end

        transactions
      end

      def parse_qif(content)
        transactions = []
        current_tx = {}

        content.each_line do |line|
          line = line.strip
          next if line.empty?

          case line[0]
          when 'D' # Date
            current_tx[:date] = parse_date(line[1..])
          when 'T', 'U' # Amount
            current_tx[:amount] = parse_decimal(line[1..])
          when 'P' # Payee
            current_tx[:description] = line[1..]
          when 'N' # Check number / reference
            current_tx[:reference] = line[1..]
          when 'M' # Memo
            current_tx[:memo] = line[1..]
          when '^' # End of transaction
            if current_tx[:date] && current_tx[:amount]
              current_tx[:description] ||= current_tx[:memo] || ''
              transactions << current_tx.except(:memo)
            end
            current_tx = {}
          end
        end

        transactions
      end

      # ═══════════════════════════════════════════════════════════════
      # COLUMN AUTO-DETECTION
      # ═══════════════════════════════════════════════════════════════

      def auto_detect_columns(headers)
        mapping = {}

        headers.each_with_index do |header, index|
          next unless header

          h = header.downcase.strip

          # Date column
          if h.match?(/date|posted|trans.*date/)
            mapping[:date] ||= index
          end

          # Description
          if h.match?(/desc|narration|memo|particulars|payee|name/)
            mapping[:description] ||= index
          end

          # Amount (single column)
          if h.match?(/^amount$|trans.*amount/)
            mapping[:amount] ||= index
          end

          # Debit column
          if h.match?(/debit|dr|withdrawal|out/)
            mapping[:debit] ||= index
          end

          # Credit column
          if h.match?(/credit|cr|deposit|in/)
            mapping[:credit] ||= index
          end

          # Balance
          if h.match?(/balance|running/)
            mapping[:balance] ||= index
          end

          # Reference
          if h.match?(/ref|check|cheque|number/)
            mapping[:reference] ||= index
          end
        end

        mapping
      end

      def suggest_columns(content)
        require 'csv'
        rows = CSV.parse(content, headers: true, liberal_parsing: true)
        return nil if rows.empty?

        {
          headers: rows.headers,
          detected_mapping: auto_detect_columns(rows.headers),
          sample_row: rows.first&.to_h
        }
      end

      # ═══════════════════════════════════════════════════════════════
      # VALUE PARSING
      # ═══════════════════════════════════════════════════════════════

      def get_column_value(row, column_index)
        return nil unless column_index

        if column_index.is_a?(Integer)
          row[column_index]
        else
          row[column_index.to_s]
        end
      end

      def parse_date(value)
        return nil if value.blank?

        DATE_FORMATS.each do |format|
          return Date.strptime(value.strip, format)
        rescue ArgumentError
          next
        end

        # Try Ruby's flexible parsing as fallback
        Date.parse(value.strip)
      rescue ArgumentError
        nil
      end

      def parse_amount(amount_str, debit_str = nil, credit_str = nil)
        # If we have separate debit/credit columns
        if debit_str.present? || credit_str.present?
          debit = parse_decimal(debit_str) || 0
          credit = parse_decimal(credit_str) || 0
          return credit - debit if debit.positive? || credit.positive?
        end

        # Single amount column
        parse_decimal(amount_str)
      end

      def parse_decimal(value)
        return nil if value.blank?

        # Remove currency symbols and whitespace
        cleaned = value.to_s.gsub(/[$£€,\s]/, '')

        # Handle parentheses for negative (accounting format)
        if cleaned.match?(/\([\d.]+\)/)
          cleaned = cleaned.gsub(/[()]/, '')
          return -cleaned.to_d
        end

        cleaned.to_d
      rescue ArgumentError
        nil
      end

      # ═══════════════════════════════════════════════════════════════
      # DUPLICATE DETECTION
      # ═══════════════════════════════════════════════════════════════

      def duplicate?(tx_data)
        # Check for existing transaction with same date, amount, and description
        Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where(gl_journal_entries: { entry_date: tx_data[:date] })
          .where(gl_journal_entries: { source_type: %w[bank_transaction bank_import] })
          .where('ABS(debit - credit) = ?', tx_data[:amount].abs)
          .exists?
      end

      # ═══════════════════════════════════════════════════════════════
      # TRANSACTION CREATION
      # ═══════════════════════════════════════════════════════════════

      def create_bank_transaction(tx_data)
        period = Gl::Period.for_date(
          corporate,
          tx_data[:date],
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        journal = Gl::JournalEntry.new(
          corporate: corporate,
          gl_period: period,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          source_type: 'bank_import',
          source_number: tx_data[:reference] || "IMP-#{tx_data[:date].strftime('%Y%m%d')}-#{SecureRandom.hex(4)}",
          entry_date: tx_data[:date],
          description: "Import: #{tx_data[:description]}",
          currency_code: account.currency_code || 'AUD',
          status: 'posted'
        )

        amount = tx_data[:amount].abs

        if tx_data[:amount].positive?
          # Money in: DR Bank, CR Suspense (to be coded)
          journal.add_debit(account, amount, description: tx_data[:description])
          suspense = find_or_create_suspense_account
          journal.add_credit(suspense, amount, description: "To be coded: #{tx_data[:description]}")
        else
          # Money out: DR Suspense (to be coded), CR Bank
          suspense = find_or_create_suspense_account
          journal.add_debit(suspense, amount, description: "To be coded: #{tx_data[:description]}")
          journal.add_credit(account, amount, description: tx_data[:description])
        end

        if journal.save
          { success: true, journal_entry: journal }
        else
          { success: false, error: journal.errors.full_messages.join(', ') }
        end
      end

      def find_or_create_suspense_account
        Gl::Account.find_or_create_by!(
          corporate: corporate,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          code: '9999'
        ) do |acc|
          acc.name = 'Bank Import Suspense'
          acc.account_type = 'liability'
          acc.account_class = 'current_liability'
          acc.description = 'Temporary account for imported bank transactions pending coding'
        end
      end
    end
  end
end
