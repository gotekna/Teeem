class XeroBankSyncService
  attr_reader :company, :connection

  def initialize(company)
    @company = company
    @connection = company.company_xero_connection
    validate_connection!
  end

  # Sync bank accounts from Xero
  # SSoT: Xero is the source of truth for bank accounts
  # Auto-creates local bank accounts for any Xero accounts that don't exist locally
  def sync_bank_accounts(auto_create: true)
    ensure_valid_token!

    # Get bank accounts from Xero
    xero_accounts = fetch_xero_bank_accounts

    created_count = 0
    linked_count = 0

    results = xero_accounts.map do |xero_account|
      # Try to match to existing bank account by account number or xero_account_id
      local_account = match_local_bank_account(xero_account)

      # SSoT: Auto-create if no local match exists and auto_create is enabled
      if local_account.nil? && auto_create
        local_account = create_bank_account_from_xero(xero_account)
        created_count += 1 if local_account.persisted?
        Rails.logger.info("[XeroBankSync] Auto-created bank account '#{local_account.display_name}' for company #{company.id}")
      end

      # Auto-link if matched but not yet linked
      if local_account && local_account.xero_account_id != xero_account["AccountID"]
        local_account.link_to_xero!(xero_account["AccountID"])
        linked_count += 1
        Rails.logger.info("[XeroBankSync] Auto-linked bank account #{local_account.id} to Xero account #{xero_account['AccountID']}")
      end

      {
        xero_account_id: xero_account["AccountID"],
        xero_account_name: xero_account["Name"],
        xero_account_number: xero_account["BankAccountNumber"],
        xero_bank_account_type: xero_account["BankAccountType"],
        local_bank_account_id: local_account&.id,
        local_bank_account_name: local_account&.display_name,
        matched: local_account.present?,
        linked: local_account&.xero_account_id == xero_account["AccountID"],
        auto_created: local_account&.persisted? && created_count > 0
      }
    end

    {
      success: true,
      xero_accounts: results,
      total_xero_accounts: xero_accounts.count,
      matched_count: results.count { |r| r[:matched] },
      linked_count: results.count { |r| r[:linked] },
      auto_created_count: created_count,
      auto_linked_count: linked_count
    }
  rescue StandardError => e
    Rails.logger.error("Failed to sync bank accounts for company #{company.id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Link a local bank account to a Xero bank account
  def link_bank_account(bank_account_id:, xero_account_id:)
    bank_account = company.bank_accounts.find(bank_account_id)
    bank_account.link_to_xero!(xero_account_id)

    { success: true, bank_account: bank_account }
  rescue ActiveRecord::RecordNotFound
    { success: false, error: "Bank account not found" }
  rescue StandardError => e
    { success: false, error: e.message }
  end

  # Sync transactions for a specific bank account or all linked accounts
  def sync_transactions(bank_account_id: nil, from_date: 3.months.ago.to_date, to_date: Date.today)
    ensure_valid_token!

    accounts_to_sync = if bank_account_id
      [ company.bank_accounts.find(bank_account_id) ]
    else
      company.bank_accounts.where.not(xero_account_id: nil)
    end

    if accounts_to_sync.empty?
      return { success: false, error: "No linked bank accounts to sync" }
    end

    total_synced = 0
    total_created = 0
    total_updated = 0
    errors = []

    accounts_to_sync.each do |bank_account|
      result = sync_transactions_for_account(bank_account, from_date, to_date)
      if result[:success]
        total_synced += result[:synced_count]
        total_created += result[:created_count]
        total_updated += result[:updated_count]
      else
        errors << { bank_account_id: bank_account.id, error: result[:error] }
      end
    end

    # Update connection sync timestamp
    connection.sync_successful! if errors.empty?

    {
      success: errors.empty?,
      accounts_synced: accounts_to_sync.count,
      total_transactions_synced: total_synced,
      created_count: total_created,
      updated_count: total_updated,
      errors: errors
    }
  end

  # Get transaction summary for a bank account
  def transaction_summary(bank_account_id: nil, from_date: 1.month.ago.to_date, to_date: Date.today)
    transactions = company.bank_transactions.by_date_range(from_date, to_date)
    transactions = transactions.where(bank_account_id: bank_account_id) if bank_account_id

    credits = transactions.credits.sum(:amount)
    debits = transactions.debits.sum(:amount)

    {
      total_transactions: transactions.count,
      total_credits: credits,
      total_debits: debits,
      net_change: credits - debits,
      reconciled_count: transactions.reconciled.count,
      unreconciled_count: transactions.unreconciled.count,
      date_range: { from: from_date, to: to_date }
    }
  end

  private

  def validate_connection!
    raise XeroApiClient::AuthenticationError, "Company is not connected to Xero" unless connection&.connected?
  end

  def ensure_valid_token!
    if connection.needs_refresh?
      unless connection.refresh_tokens!
        raise XeroApiClient::AuthenticationError, "Failed to refresh Xero tokens"
      end
    end
  end

  def fetch_xero_bank_accounts
    client = XeroApiClient.new
    response = make_xero_request(client, "Accounts", { where: 'Type=="BANK"' })

    if response[:success]
      response[:data]["Accounts"] || []
    else
      raise XeroApiClient::ApiError, "Failed to fetch bank accounts from Xero"
    end
  end

  def match_local_bank_account(xero_account)
    # First try to find by xero_account_id (already linked)
    linked = company.bank_accounts.find_by(xero_account_id: xero_account["AccountID"])
    return linked if linked

    xero_account_number = xero_account["BankAccountNumber"]&.gsub(/\D/, "")
    return nil unless xero_account_number.present?

    # Then try to match by account number (last 4-10 digits)
    company.bank_accounts.find do |ba|
      local_number = ba.account_number&.gsub(/\D/, "")
      next unless local_number.present?

      # Match if last 6+ digits match
      local_suffix = local_number.last(6)
      xero_suffix = xero_account_number.last(6)
      local_suffix == xero_suffix
    end
  end

  # SSoT: Create a local bank account from Xero data
  def create_bank_account_from_xero(xero_account)
    # Parse institution name from Xero account name
    # Xero names are like "NAB - 302971208", "Westpac Business", "Stripe AUD", etc.
    xero_name = xero_account["Name"] || "Unknown Bank"
    institution_name = extract_institution_name(xero_name)

    # Extract account number - use Xero's BankAccountNumber or parse from name
    account_number = xero_account["BankAccountNumber"] || extract_account_number(xero_name) || "XERO"

    # Extract BSB if present in the account number (Australian format: 6 digit BSB + account)
    bsb = nil
    if account_number.length >= 6 && account_number =~ /^\d+$/
      # If it looks like BSB+Account (e.g., "084435302971208"), extract BSB
      clean_number = account_number.gsub(/\D/, "")
      if clean_number.length > 10
        bsb = clean_number[0..5]
        account_number = clean_number[6..]
      end
    end

    company.bank_accounts.create!(
      institution_name: institution_name,
      bsb: bsb,
      account_number: account_number,
      account_name: xero_name,
      xero_account_id: xero_account["AccountID"],
      status: "active",
      date_opened: Date.today
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("[XeroBankSync] Failed to create bank account from Xero: #{e.message}")
    # Return nil so sync can continue with other accounts
    nil
  end

  # Extract bank institution name from Xero account name
  def extract_institution_name(xero_name)
    # Common patterns: "NAB - 302971208", "Westpac Business Account", "Stripe AUD"
    bank_patterns = {
      /\bNAB\b/i => "NAB",
      /\bNational Australia\b/i => "NAB",
      /\bWestpac\b/i => "Westpac",
      /\bWBC\b/i => "Westpac",
      /\bCommonwealth\b/i => "Commonwealth Bank",
      /\bCommBank\b/i => "Commonwealth Bank",
      /\bCBA\b/i => "Commonwealth Bank",
      /\bANZ\b/i => "ANZ",
      /\bBOQ\b/i => "Bank of Queensland",
      /\bBank of Queensland\b/i => "Bank of Queensland",
      /\bStripe\b/i => "Stripe",
      /\bPayPal\b/i => "PayPal",
      /\bSimple Saver\b/i => "Simple Saver"
    }

    bank_patterns.each do |pattern, name|
      return name if xero_name =~ pattern
    end

    # If no match, take first word or use full name
    xero_name.split(/[\s\-–]/).first || xero_name
  end

  # Extract account number from name if not provided separately
  def extract_account_number(xero_name)
    # Look for numeric sequences that look like account numbers
    match = xero_name.match(/(\d{4,})/)
    match ? match[1] : nil
  end

  def sync_transactions_for_account(bank_account, from_date, to_date)
    xero_transactions = fetch_xero_transactions(bank_account.xero_account_id, from_date, to_date)

    created_count = 0
    updated_count = 0

    xero_transactions.each do |xero_tx|
      transaction = BankTransaction.upsert_from_xero(
        company: company,
        xero_transaction: xero_tx,
        bank_account: bank_account
      )

      if transaction.previously_new_record?
        created_count += 1
      else
        updated_count += 1
      end
    end

    {
      success: true,
      synced_count: xero_transactions.count,
      created_count: created_count,
      updated_count: updated_count
    }
  rescue StandardError => e
    Rails.logger.error("Failed to sync transactions for bank account #{bank_account.id}: #{e.message}")
    { success: false, error: e.message }
  end

  def fetch_xero_transactions(xero_account_id, from_date, to_date)
    client = XeroApiClient.new

    # Build where clause for date range and bank account
    where_clause = "BankAccount.AccountID==Guid(\"#{xero_account_id}\")"

    response = make_xero_request(client, "BankTransactions", {
      where: where_clause,
      order: "Date DESC"
    })

    if response[:success]
      transactions = response[:data]["BankTransactions"] || []
      # Filter by date range (Xero API doesn't support date range in where for BankTransactions)
      transactions.select do |tx|
        tx_date = Date.parse(tx["Date"]) rescue nil
        tx_date && tx_date >= from_date && tx_date <= to_date
      end
    else
      raise XeroApiClient::ApiError, "Failed to fetch transactions from Xero"
    end
  end

  def make_xero_request(client, endpoint, params = {})
    # Add tenant_id to params for company-specific requests
    params[:tenant_id] = connection.xero_tenant_id

    client.get(endpoint, params)
  end
end
