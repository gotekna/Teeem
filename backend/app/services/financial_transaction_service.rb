class FinancialTransactionService
  class TransactionError < StandardError; end

  def initialize(user:, company:)
    @user = user
    @company = company
  end

  # Create income transaction with Keepr journal entry
  def create_income(params)
    validate_params!(params, :income)

    ActiveRecord::Base.transaction do
      # Create financial transaction record
      transaction = FinancialTransaction.new(
        transaction_type: 'income',
        amount: params[:amount],
        transaction_date: params[:transaction_date],
        description: params[:description],
        category: params[:category] || 'Job Revenue',
        status: 'draft',
        user: @user,
        company: @company,
        construction_id: params[:construction_id]
      )

      # Attach receipt if provided
      transaction.receipt.attach(params[:receipt]) if params[:receipt].present?

      transaction.save!

      # Auto-post if requested
      if params[:auto_post]
        post_transaction(transaction)
      end

      transaction
    end
  rescue ActiveRecord::RecordInvalid => e
    raise TransactionError, "Failed to create income transaction: #{e.message}"
  end

  # Create expense transaction with Keepr journal entry
  def create_expense(params)
    validate_params!(params, :expense)

    ActiveRecord::Base.transaction do
      # Create financial transaction record
      transaction = FinancialTransaction.new(
        transaction_type: 'expense',
        amount: params[:amount],
        transaction_date: params[:transaction_date],
        description: params[:description],
        category: params[:category] || 'Other Expenses',
        status: 'draft',
        user: @user,
        company: @company,
        construction_id: params[:construction_id]
      )

      # Attach receipt if provided
      transaction.receipt.attach(params[:receipt]) if params[:receipt].present?

      transaction.save!

      # Auto-post if requested
      if params[:auto_post]
        post_transaction(transaction)
      end

      transaction
    end
  rescue ActiveRecord::RecordInvalid => e
    raise TransactionError, "Failed to create expense transaction: #{e.message}"
  end

  # Post a draft transaction (creates Keepr journal entries)
  def post_transaction(transaction)
    raise TransactionError, "Transaction is already posted" unless transaction.status_draft?

    ActiveRecord::Base.transaction do
      # Create Keepr journal entry
      journal = create_journal_entry(transaction)

      # Update transaction with journal reference and posted status
      transaction.update!(
        keepr_journal_id: journal.id,
        status: 'posted'
      )

      # Queue for sync if auto-sync is enabled
      queue_sync_if_enabled(transaction)

      transaction
    end
  rescue => e
    raise TransactionError, "Failed to post transaction: #{e.message}"
  end

  # Update an existing transaction
  def update_transaction(transaction, params)
    raise TransactionError, "Cannot edit synced transactions" if transaction.status_synced?

    ActiveRecord::Base.transaction do
      # If transaction is posted, we need to reverse and recreate the journal
      if transaction.status_posted?
        reverse_journal_entry(transaction)
      end

      # Update transaction fields
      transaction.update!(
        amount: params[:amount] || transaction.amount,
        transaction_date: params[:transaction_date] || transaction.transaction_date,
        description: params[:description] || transaction.description,
        category: params[:category] || transaction.category,
        construction_id: params[:construction_id]
      )

      # Attach new receipt if provided
      if params[:receipt].present?
        transaction.receipt.purge if transaction.receipt.attached?
        transaction.receipt.attach(params[:receipt])
      end

      # Re-post if it was previously posted
      if transaction.status_posted?
        post_transaction(transaction)
      end

      transaction
    end
  rescue ActiveRecord::RecordInvalid => e
    raise TransactionError, "Failed to update transaction: #{e.message}"
  end

  # Delete a transaction
  def delete_transaction(transaction)
    raise TransactionError, "Cannot delete synced transactions" if transaction.status_synced?

    ActiveRecord::Base.transaction do
      # Reverse journal entry if posted
      if transaction.status_posted? && transaction.keepr_journal.present?
        reverse_journal_entry(transaction)
      end

      # Delete the transaction
      transaction.destroy!
    end
  rescue => e
    raise TransactionError, "Failed to delete transaction: #{e.message}"
  end

  private

  def validate_params!(params, type)
    raise TransactionError, "Amount is required" unless params[:amount].present?
    raise TransactionError, "Transaction date is required" unless params[:transaction_date].present?
    raise TransactionError, "Amount must be positive" unless params[:amount].to_f > 0
  end

  def create_journal_entry(transaction)
    # Get the relevant accounts
    bank_account = Keepr::Account.find_by(number: 1000) # Cash - Bank Account
    revenue_expense_account = get_account_for_category(transaction.category, transaction.transaction_type)

    raise TransactionError, "Bank account not found" unless bank_account
    raise TransactionError, "Revenue/Expense account not found" unless revenue_expense_account

    # Create journal
    journal = Keepr::Journal.create!(
      subject: "#{transaction.transaction_type.capitalize}: #{transaction.description}",
      date: transaction.transaction_date
    )

    # Create postings based on transaction type
    if transaction.income?
      # Income: Debit Bank, Credit Revenue
      Keepr::Posting.create!(
        keepr_journal: journal,
        keepr_account: bank_account,
        amount: transaction.amount,
        side: :debit
      )

      Keepr::Posting.create!(
        keepr_journal: journal,
        keepr_account: revenue_expense_account,
        amount: transaction.amount,
        side: :credit
      )
    else
      # Expense: Debit Expense, Credit Bank
      Keepr::Posting.create!(
        keepr_journal: journal,
        keepr_account: revenue_expense_account,
        amount: transaction.amount,
        side: :debit
      )

      Keepr::Posting.create!(
        keepr_journal: journal,
        keepr_account: bank_account,
        amount: transaction.amount,
        side: :credit
      )
    end

    journal
  end

  def reverse_journal_entry(transaction)
    return unless transaction.keepr_journal.present?

    journal = transaction.keepr_journal

    # Create reversal journal
    reversal = Keepr::Journal.create!(
      subject: "REVERSAL: #{journal.subject}",
      date: Date.current
    )

    # Create opposite postings
    journal.keepr_postings.each do |posting|
      Keepr::Posting.create!(
        keepr_journal: reversal,
        keepr_account: posting.keepr_account,
        amount: posting.amount,
        side: posting.side == :debit ? :credit : :debit
      )
    end

    # Clear the journal reference
    transaction.update!(keepr_journal_id: nil, status: 'draft')
  end

  def get_account_for_category(category, type)
    # Map categories to account numbers
    account_map = {
      'income' => {
        'Job Revenue' => 4000,
        'Material Sales' => 4100,
        'Other Income' => 4200
      },
      'expense' => {
        'Materials' => 5000,
        'Labour' => 5100,
        'Subcontractors' => 5200,
        'Tools & Equipment' => 5300,
        'Fuel & Transport' => 5400,
        'Insurance' => 5500,
        'Professional Fees' => 5600,
        'Other Expenses' => 5700
      }
    }

    account_number = account_map[type]&.[](category)
    account_number ||= type == 'income' ? 4200 : 5700 # Default to "Other"

    Keepr::Account.find_by(number: account_number)
  end

  def queue_sync_if_enabled(transaction)
    # Check if company has accounting integration with auto-sync enabled
    integrations = AccountingIntegration.active
                                       .joins(:contact)
                                       .where(contacts: { company_id: @company.id })
                                       .select { |i| i.auto_sync_enabled? }

    integrations.each do |integration|
      # Queue sync job for each active integration
      # SyncTransactionJob.perform_later(transaction.id, integration.id)
      # TODO: Implement when sync jobs are created
    end
  end
end
