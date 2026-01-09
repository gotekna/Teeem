# frozen_string_literal: true

module Gl
  module Journalizers
    # Journalizes sales invoices and bills
    #
    # Sales Invoice (ACCREC):
    #   DR  Accounts Receivable     $1,100
    #     CR  Sales Revenue                   $1,000
    #     CR  GST Collected                   $  100
    #
    # Bill (ACCPAY):
    #   DR  Expense Account         $1,000
    #   DR  GST Paid                $  100
    #     CR  Accounts Payable                $1,100
    #
    class Invoice < Base
      def journalize
        return existing_entry if already_journalized?

        case source.invoice_type
        when 'sales_invoice'
          journalize_sales_invoice
        when 'bill'
          journalize_bill
        when 'credit_note'
          journalize_credit_note
        else
          raise ArgumentError, "Unknown invoice type: #{source.invoice_type}"
        end
      end

      private

      def already_journalized?
        source.journalized? && source.gl_journal_entry.present?
      end

      def existing_entry
        source.gl_journal_entry
      end

      def journalize_sales_invoice
        period = period_for(source.invoice_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'invoice',
          source_id: source.id.to_s,
          source_number: source.invoice_number,
          entry_date: source.invoice_date,
          description: "Invoice #{source.invoice_number} - #{source.contact_name}",
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0,
          job: source.job
        )

        # DR Accounts Receivable for total
        ar = accounts_receivable
        journal.add_debit(
          ar,
          source.total,
          description: source.contact_name,
          reference: source.invoice_number,
          contact: source.contact
        )

        # CR Revenue and GST per line
        source.lines.each do |line|
          revenue_account = line.gl_account || sales_account

          # CR Revenue for line amount (ex-GST)
          journal.add_credit(
            revenue_account,
            line.line_amount,
            description: line.description,
            reference: source.invoice_number,
            job: line.job || source.job,
            tracking_category_1: line.tracking_category_1,
            tracking_option_1: line.tracking_option_1
          )

          # CR GST Collected if applicable
          if line.tax_amount.to_d > 0
            gst = gst_collected
            journal.add_credit(
              gst,
              line.tax_amount,
              description: "GST on #{line.description}",
              tax_type: line.tax_type
            ) if gst
          end
        end

        save_journal(journal)
      end

      def journalize_bill
        period = period_for(source.invoice_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'bill',
          source_id: source.id.to_s,
          source_number: source.invoice_number,
          entry_date: source.invoice_date,
          description: "Bill #{source.invoice_number} - #{source.contact_name}",
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0,
          job: source.job
        )

        # DR Expense and GST per line
        source.lines.each do |line|
          expense_acct = line.gl_account || expense_account

          # DR Expense for line amount (ex-GST)
          journal.add_debit(
            expense_acct,
            line.line_amount,
            description: line.description,
            reference: source.invoice_number,
            job: line.job || source.job,
            tracking_category_1: line.tracking_category_1,
            tracking_option_1: line.tracking_option_1
          )

          # DR GST Paid if applicable
          if line.tax_amount.to_d > 0
            gst = gst_paid
            journal.add_debit(
              gst,
              line.tax_amount,
              description: "GST on #{line.description}",
              tax_type: line.tax_type
            ) if gst
          end
        end

        # CR Accounts Payable for total
        ap = accounts_payable
        journal.add_credit(
          ap,
          source.total,
          description: source.contact_name,
          reference: source.invoice_number,
          contact: source.contact
        )

        save_journal(journal)
      end

      def journalize_credit_note
        # Credit notes are reversals of invoices
        # If it's a sales credit note, reverse the invoice entry
        # If it's a supplier credit note, reverse the bill entry

        # Determine type from tracking data or default to sales
        is_sales = !source.tracking_data&.dig('credit_type')&.in?(%w[supplier_credit ACCPAYCREDIT])

        if is_sales
          journalize_sales_credit_note
        else
          journalize_supplier_credit_note
        end
      end

      def journalize_sales_credit_note
        period = period_for(source.invoice_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'credit_note',
          source_id: source.id.to_s,
          source_number: source.invoice_number,
          entry_date: source.invoice_date,
          description: "Credit Note #{source.invoice_number} - #{source.contact_name}",
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0,
          job: source.job
        )

        # Reverse of sales invoice:
        # DR Revenue (reduce sales)
        # DR GST Collected (reduce GST liability)
        # CR Accounts Receivable (reduce what customer owes)

        source.lines.each do |line|
          revenue_account = line.gl_account || sales_account

          journal.add_debit(
            revenue_account,
            line.line_amount,
            description: line.description,
            reference: source.invoice_number,
            job: line.job || source.job
          )

          if line.tax_amount.to_d > 0
            gst = gst_collected
            journal.add_debit(gst, line.tax_amount) if gst
          end
        end

        ar = accounts_receivable
        journal.add_credit(
          ar,
          source.total,
          description: source.contact_name,
          contact: source.contact
        )

        save_journal(journal)
      end

      def journalize_supplier_credit_note
        period = period_for(source.invoice_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'credit_note',
          source_id: source.id.to_s,
          source_number: source.invoice_number,
          entry_date: source.invoice_date,
          description: "Supplier Credit #{source.invoice_number} - #{source.contact_name}",
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0,
          job: source.job
        )

        # Reverse of bill:
        # DR Accounts Payable (reduce what we owe)
        # CR Expense (reduce expense)
        # CR GST Paid (reduce GST asset)

        ap = accounts_payable
        journal.add_debit(
          ap,
          source.total,
          description: source.contact_name,
          contact: source.contact
        )

        source.lines.each do |line|
          expense_acct = line.gl_account || expense_account

          journal.add_credit(
            expense_acct,
            line.line_amount,
            description: line.description,
            reference: source.invoice_number,
            job: line.job || source.job
          )

          if line.tax_amount.to_d > 0
            gst = gst_paid
            journal.add_credit(gst, line.tax_amount) if gst
          end
        end

        save_journal(journal)
      end

      def save_journal(journal)
        if journal.save
          journal
        else
          Rails.logger.error("[Journalizer] Failed to save journal for invoice #{source.id}: #{journal.errors.full_messages.join(', ')}")
          journal
        end
      end
    end
  end
end
