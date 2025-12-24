class XeroBankSyncService
  attr_reader :company, :connection

  # BSB prefix to bank code mapping (Australian banks)
  BSB_BANK_CODES = {
    "082" => "NAB", "083" => "NAB", "084" => "NAB", "085" => "NAB", "086" => "NAB", "087" => "NAB",
    "062" => "CBA", "063" => "CBA", "064" => "CBA", "065" => "CBA", "066" => "CBA", "067" => "CBA",
    "012" => "ANZ", "013" => "ANZ", "014" => "ANZ", "015" => "ANZ", "016" => "ANZ", "017" => "ANZ",
    "032" => "WBC", "033" => "WBC", "034" => "WBC", "035" => "WBC", "036" => "WBC", "037" => "WBC",
    "124" => "BOQ",
    "484" => "SUNCORP"
  }.freeze

  def initialize(company)
    @company = company
    @connection = company.company_xero_connection
    validate_connection!
  end

  # Sync bank accounts from Xero
  # SSoT: Xero is the source of truth for bank accounts
  # - Auto-creates local bank accounts for any Xero accounts that don't exist locally
  # - Renames Xero accounts to standardized format: {BANK_CODE} {BSB} {ACCOUNT_NUMBER}
  # - Sets date_opened from first transaction in Xero
  # - Sets status/date_closed based on Xero ARCHIVED status
  def sync_bank_accounts(auto_create: true, rename_xero: true)
    ensure_valid_token!

    # Get bank accounts from Xero
    xero_accounts = fetch_xero_bank_accounts

    created_count = 0
    linked_count = 0
    renamed_count = 0
    updated_count = 0

    results = xero_accounts.map do |xero_account|
      result = {
        xero_account_id: xero_account["AccountID"],
        xero_account_name: xero_account["Name"],
        xero_account_number: xero_account["BankAccountNumber"],
        xero_bank_account_type: xero_account["BankAccountType"],
        xero_status: xero_account["Status"]
      }

      # Try to match to existing bank account by account number or xero_account_id
      local_account = match_local_bank_account(xero_account)

      # SSoT: Auto-create if no local match exists and auto_create is enabled
      if local_account.nil? && auto_create
        local_account = create_bank_account_from_xero(xero_account)
        if local_account&.persisted?
          created_count += 1
          Rails.logger.info("[XeroBankSync] Auto-created bank account '#{local_account.display_name}' for company #{company.id}")
        end
      end

      # Auto-link if matched but not yet linked
      if local_account && local_account.xero_account_id != xero_account["AccountID"]
        local_account.link_to_xero!(xero_account["AccountID"])
        linked_count += 1
        Rails.logger.info("[XeroBankSync] Auto-linked bank account #{local_account.id} to Xero account #{xero_account['AccountID']}")
      end

      # Update existing account with Xero data (status, dates, official name)
      if local_account&.persisted?
        if update_local_account_from_xero(local_account, xero_account)
          updated_count += 1
        end
      end

      # Rename Xero account to standardized format if enabled
      if rename_xero && local_account&.persisted?
        rename_result = rename_xero_account_to_standard(xero_account, local_account)
        if rename_result[:renamed]
          renamed_count += 1
          result[:new_xero_name] = rename_result[:new_name]
        end
      end

      result.merge(
        local_bank_account_id: local_account&.id,
        local_bank_account_name: local_account&.display_name,
        matched: local_account.present?,
        linked: local_account&.xero_account_id == xero_account["AccountID"],
        auto_created: local_account&.persisted? && created_count > 0
      )
    end

    {
      success: true,
      xero_accounts: results,
      total_xero_accounts: xero_accounts.count,
      matched_count: results.count { |r| r[:matched] },
      linked_count: results.count { |r| r[:linked] },
      auto_created_count: created_count,
      auto_linked_count: linked_count,
      renamed_count: renamed_count,
      updated_count: updated_count
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
    xero_name = xero_account["Name"] || "Unknown Bank"
    bank_account_number = xero_account["BankAccountNumber"]

    # Parse BSB and account number from Xero's BankAccountNumber
    parsed = parse_bank_account_number(bank_account_number, xero_name)

    # Determine bank code from BSB or name
    bank_code = detect_bank_code(parsed[:bsb], xero_name)

    # Get institution name from bank code
    institution_name = institution_name_from_code(bank_code)

    # Determine status from Xero (ACTIVE or ARCHIVED)
    xero_status = xero_account["Status"]
    is_closed = xero_status == "ARCHIVED"

    # Try to get first transaction date for date_opened
    date_opened = fetch_first_transaction_date(xero_account["AccountID"])

    # For closed accounts, get last transaction date as close date
    date_closed = nil
    if is_closed
      date_closed = fetch_last_transaction_date(xero_account["AccountID"]) || Date.today
    end

    # Store original bank name if not already in standardized format
    # Standardized format: "NAB 083-052 305422840"
    is_standardized_name = xero_name.match?(/^[A-Z]{2,7}\s+\d{3}[- ]?\d{3}\s+\d+$/)
    bank_feed_name = is_standardized_name ? nil : xero_name

    company.bank_accounts.create!(
      institution_name: institution_name,
      bank_code: bank_code,
      bsb: parsed[:bsb],
      account_number: parsed[:account_number],
      account_name: xero_name,
      bank_feed_name: bank_feed_name, # Original official bank account name
      xero_account_id: xero_account["AccountID"],
      status: is_closed ? "closed" : "active",
      date_opened: date_opened,
      date_closed: date_closed
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("[XeroBankSync] Failed to create bank account from Xero: #{e.message}")
    # Return nil so sync can continue with other accounts
    nil
  end

  # Update existing local account with Xero data
  def update_local_account_from_xero(local_account, xero_account)
    xero_name = xero_account["Name"] || "Unknown Bank"
    bank_account_number = xero_account["BankAccountNumber"]
    xero_status = xero_account["Status"]
    is_closed = xero_status == "ARCHIVED"

    changes = {}

    # Store original bank account name in bank_feed_name (before we rename it)
    # Only if blank and current Xero name is NOT already our standardized format
    # Standardized format: "NAB 083-052 305422840" (BANK BSB-BSB ACCOUNT)
    is_standardized_name = xero_name.match?(/^[A-Z]{2,7}\s+\d{3}[- ]?\d{3}\s+\d+$/)
    if local_account.bank_feed_name.blank? && !is_standardized_name
      changes[:bank_feed_name] = xero_name
    end

    # Store Xero name as account_name (keeps in sync with Xero)
    if local_account.account_name != xero_name
      changes[:account_name] = xero_name
    end

    # Update BSB and account number if we have better data from Xero
    if bank_account_number.present?
      parsed = parse_bank_account_number(bank_account_number, xero_name)
      if parsed[:bsb].present? && local_account.bsb != parsed[:bsb]
        changes[:bsb] = parsed[:bsb]
      end
      if parsed[:account_number].present? && local_account.account_number != parsed[:account_number]
        changes[:account_number] = parsed[:account_number]
      end

      # Update bank code if we can detect it
      bank_code = detect_bank_code(parsed[:bsb], xero_name)
      if bank_code.present? && local_account.bank_code != bank_code
        changes[:bank_code] = bank_code
        changes[:institution_name] = institution_name_from_code(bank_code)
      end
    end

    # Update status if account is archived in Xero
    if is_closed && local_account.status != "closed"
      changes[:status] = "closed"
      # Use last transaction date as close date (when bank feed stopped)
      unless local_account.date_closed.present?
        last_tx_date = fetch_last_transaction_date(xero_account["AccountID"])
        changes[:date_closed] = last_tx_date || Date.today
      end
    elsif !is_closed && local_account.status == "closed"
      # Account was re-opened in Xero
      changes[:status] = "active"
      changes[:date_closed] = nil
    end

    # Set date_opened from first transaction if not already set
    if local_account.date_opened.blank?
      date_opened = fetch_first_transaction_date(xero_account["AccountID"])
      changes[:date_opened] = date_opened if date_opened.present?
    end

    if changes.any?
      local_account.update!(changes)
      Rails.logger.info("[XeroBankSync] Updated bank account #{local_account.id}: #{changes.keys.join(', ')}")
      true
    else
      false
    end
  rescue StandardError => e
    Rails.logger.error("[XeroBankSync] Failed to update bank account #{local_account.id}: #{e.message}")
    false
  end

  # Rename Xero account to standardized format: {BANK_CODE} {BSB} {ACCOUNT_NUMBER} - {STATEMENT_NAME}
  def rename_xero_account_to_standard(xero_account, local_account = nil)
    xero_account_id = xero_account["AccountID"]
    current_name = xero_account["Name"]
    bank_account_number = xero_account["BankAccountNumber"]

    # Skip if no bank account number
    return { renamed: false, reason: "No bank account number" } unless bank_account_number.present?

    # Parse BSB and account number
    parsed = parse_bank_account_number(bank_account_number, current_name)

    # Skip if BSB is invalid
    unless parsed[:bsb].present? && parsed[:bsb].match?(/^\d{6}$/)
      return { renamed: false, reason: "Invalid BSB format" }
    end

    # Detect bank code
    bank_code = detect_bank_code(parsed[:bsb], current_name)

    # Format BSB as XXX-XXX
    formatted_bsb = "#{parsed[:bsb][0..2]}-#{parsed[:bsb][3..5]}"

    # Build standardized name: "{BANK_CODE} {BSB} {ACCOUNT_NUMBER}"
    new_name = "#{bank_code} #{formatted_bsb} #{parsed[:account_number]}"

    # Append statement name (company name from bank statement) if available
    if local_account&.bank_feed_name.present?
      new_name += " - #{local_account.bank_feed_name}"
    end

    # Skip if already has the correct name
    if current_name == new_name
      return { renamed: false, reason: "Already standardized" }
    end

    # Rename in Xero
    client = XeroApiClient.new
    result = client.update_account_name(
      xero_account_id,
      new_name,
      tenant_id: connection.xero_tenant_id,
      access_token: connection.access_token
    )

    if result[:success]
      Rails.logger.info("[XeroBankSync] Renamed Xero account: '#{current_name}' -> '#{new_name}'")
      { renamed: true, old_name: current_name, new_name: new_name }
    else
      Rails.logger.warn("[XeroBankSync] Failed to rename Xero account: #{result[:error]}")
      { renamed: false, reason: result[:error] }
    end
  rescue StandardError => e
    Rails.logger.error("[XeroBankSync] Error renaming Xero account: #{e.message}")
    { renamed: false, reason: e.message }
  end

  # Parse Xero BankAccountNumber into BSB and account number
  # Format is typically: BSBACCOUNTNUMBER (e.g., "084435259449309")
  def parse_bank_account_number(bank_account_number, xero_name = nil)
    return { bsb: nil, account_number: extract_account_number(xero_name) || "UNKNOWN" } if bank_account_number.blank?

    clean_number = bank_account_number.gsub(/\D/, "")

    # Australian format: 6 digit BSB + account number
    if clean_number.length > 10 && clean_number.match?(/^\d+$/)
      {
        bsb: clean_number[0..5],
        account_number: clean_number[6..]
      }
    elsif clean_number.length >= 6
      # Maybe just an account number without BSB
      {
        bsb: nil,
        account_number: clean_number
      }
    else
      {
        bsb: nil,
        account_number: bank_account_number
      }
    end
  end

  # Detect bank code from BSB prefix or account name
  def detect_bank_code(bsb, xero_name)
    # First try BSB prefix
    if bsb.present? && bsb.length >= 3
      bsb_prefix = bsb[0..2]
      return BSB_BANK_CODES[bsb_prefix] if BSB_BANK_CODES[bsb_prefix]
    end

    # Fallback: detect from account name
    name_lower = xero_name.to_s.downcase
    if name_lower.include?("nab") || name_lower.include?("national australia")
      "NAB"
    elsif name_lower.include?("cba") || name_lower.include?("commonwealth") || name_lower.include?("commbank")
      "CBA"
    elsif name_lower.include?("anz")
      "ANZ"
    elsif name_lower.include?("westpac") || name_lower.include?("wbc")
      "WBC"
    elsif name_lower.include?("boq") || name_lower.include?("bank of queensland")
      "BOQ"
    elsif name_lower.include?("suncorp")
      "SUNCORP"
    elsif name_lower.include?("stripe")
      "STRIPE"
    elsif name_lower.include?("simple saver")
      "SS"
    elsif name_lower.include?("lawyer") || name_lower.include?("trust")
      "TRUST"
    else
      "OTHER"
    end
  end

  # Get institution name from bank code
  def institution_name_from_code(bank_code)
    {
      "NAB" => "NAB",
      "CBA" => "Commonwealth Bank",
      "ANZ" => "ANZ",
      "WBC" => "Westpac",
      "BOQ" => "Bank of Queensland",
      "SUNCORP" => "Suncorp",
      "STRIPE" => "Stripe",
      "SS" => "Simple Saver",
      "TRUST" => "Trust Account",
      "OTHER" => "Other Bank"
    }[bank_code] || bank_code
  end

  # Fetch first or last transaction date from Xero for a bank account
  # order: :asc for first (date_opened), :desc for last (date_closed)
  def fetch_transaction_date(xero_account_id, order: :asc)
    client = XeroApiClient.new
    response = make_xero_request(client, "BankTransactions", {
      where: "BankAccount.AccountID==Guid(\"#{xero_account_id}\")",
      order: order == :desc ? "Date DESC" : "Date ASC",
      page: 1
    })

    return nil unless response[:success]

    transactions = response[:data]["BankTransactions"] || []
    return nil if transactions.empty?

    # Parse the transaction date
    tx = transactions.first
    date_str = tx["Date"]
    return nil unless date_str.present?

    # Xero returns dates in /Date(timestamp+timezone)/ format, e.g., /Date(1654041600000+0000)/
    if date_str.match?(%r{/Date\((\d+)[+-]?\d*\)/})
      timestamp = date_str.match(%r{/Date\((\d+)[+-]?\d*\)/})[1].to_i / 1000
      Time.at(timestamp).to_date
    else
      Date.parse(date_str) rescue nil
    end
  rescue StandardError => e
    Rails.logger.warn("[XeroBankSync] Failed to fetch transaction date: #{e.message}")
    nil
  end

  # Fetch first transaction date (for date_opened)
  def fetch_first_transaction_date(xero_account_id)
    fetch_transaction_date(xero_account_id, order: :asc)
  end

  # Fetch last transaction date (for date_closed when account is archived)
  def fetch_last_transaction_date(xero_account_id)
    fetch_transaction_date(xero_account_id, order: :desc)
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
