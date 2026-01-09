# frozen_string_literal: true

module Gl
  module Journalizers
    # Journalizes payments
    #
    # Customer Payment (receiving money):
    #   DR  Bank Account            $1,100
    #     CR  Accounts Receivable             $1,100
    #
    # Supplier Payment (paying money):
    #   DR  Accounts Payable        $1,100
    #     CR  Bank Account                    $1,100
    #
    # Refund to Customer:
    #   DR  Accounts Receivable     $1,100
    #     CR  Bank Account                    $1,100
    #
    class Payment < Base
      def journalize
        return existing_entry if already_journalized?

        case source.payment_type
        when 'customer_payment'
          journalize_customer_payment
        when 'supplier_payment'
          journalize_supplier_payment
        when 'refund'
          journalize_refund
        else
          raise ArgumentError, "Unknown payment type: #{source.payment_type}"
        end
      end

      private

      def already_journalized?
        source.journalized? && source.gl_journal_entry.present?
      end

      def existing_entry
        source.gl_journal_entry
      end

      def bank_account
        source.gl_account || find_system_account('bank') || find_account_by_code('090')
      end

      def journalize_customer_payment
        period = period_for(source.payment_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'payment',
          source_id: source.id.to_s,
          source_number: source.payment_number,
          entry_date: source.payment_date,
          description: payment_description('from'),
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0
        )

        # DR Bank Account
        bank = bank_account
        journal.add_debit(
          bank,
          source.amount,
          description: source.contact_name,
          reference: source.reference,
          contact: source.contact
        )

        # CR Accounts Receivable
        ar = accounts_receivable
        journal.add_credit(
          ar,
          source.amount,
          description: allocated_invoices_description,
          contact: source.contact
        )

        save_journal(journal)
      end

      def journalize_supplier_payment
        period = period_for(source.payment_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'payment',
          source_id: source.id.to_s,
          source_number: source.payment_number,
          entry_date: source.payment_date,
          description: payment_description('to'),
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0
        )

        # DR Accounts Payable
        ap = accounts_payable
        journal.add_debit(
          ap,
          source.amount,
          description: allocated_invoices_description,
          contact: source.contact
        )

        # CR Bank Account
        bank = bank_account
        journal.add_credit(
          bank,
          source.amount,
          description: source.contact_name,
          reference: source.reference,
          contact: source.contact
        )

        save_journal(journal)
      end

      def journalize_refund
        period = period_for(source.payment_date)

        journal = create_journal_entry(
          gl_period: period,
          source_type: 'refund',
          source_id: source.id.to_s,
          source_number: source.payment_number,
          entry_date: source.payment_date,
          description: "Refund to #{source.contact_name}",
          currency_code: source.currency_code || 'AUD',
          exchange_rate: source.exchange_rate || 1.0
        )

        # DR Accounts Receivable (reducing credit balance)
        ar = accounts_receivable
        journal.add_debit(
          ar,
          source.amount,
          description: source.contact_name,
          contact: source.contact
        )

        # CR Bank Account
        bank = bank_account
        journal.add_credit(
          bank,
          source.amount,
          description: "Refund to #{source.contact_name}",
          reference: source.reference,
          contact: source.contact
        )

        save_journal(journal)
      end

      def payment_description(direction)
        invoices = source.invoices.pluck(:invoice_number).compact
        if invoices.any?
          "Payment #{direction} #{source.contact_name} for #{invoices.join(', ')}"
        else
          "Payment #{direction} #{source.contact_name}"
        end
      end

      def allocated_invoices_description
        invoices = source.invoices.pluck(:invoice_number).compact
        invoices.any? ? invoices.join(', ') : source.contact_name
      end

      def save_journal(journal)
        if journal.save
          journal
        else
          Rails.logger.error("[Journalizer] Failed to save journal for payment #{source.id}: #{journal.errors.full_messages.join(', ')}")
          journal
        end
      end
    end
  end
end
