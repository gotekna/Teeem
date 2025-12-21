class XeroBankTransactionSyncJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("Starting XeroBankTransactionSyncJob")

    result = {
      created: 0,
      updated: 0,
      errors: [],
      pages_fetched: 0,
      total_transactions: 0,
      tenants_synced: 0
    }

    client = XeroApiClient.new

    # 1. Sync from main XeroCredential (existing behavior)
    main_credential = XeroCredential.current
    if main_credential.present?
      tenant_result = sync_tenant(client, main_credential.tenant_id, result)
      result[:tenants_synced] += 1 if tenant_result[:success]
    else
      Rails.logger.warn("[BankTransactionSync] No main Xero credential found")
    end

    # 2. Sync from ALL connected corporate company Xero connections
    CorporateCompanyXeroConnection.with_credential.includes(:xero_credential, :corporate_company).each do |connection|
      next unless connection.connected?
      next if connection.xero_tenant_id == main_credential&.tenant_id  # Skip if same as main

      Rails.logger.info("[BankTransactionSync] Syncing corporate company: #{connection.corporate_company&.name} (tenant: #{connection.xero_tenant_id})")
      tenant_result = sync_tenant(client, connection.xero_tenant_id, result)
      result[:tenants_synced] += 1 if tenant_result[:success]
    end

    Rails.logger.info("XeroBankTransactionSyncJob completed: #{result.inspect}")
    result
  end

  private

  # Sync bank transactions for a specific Xero tenant
  def sync_tenant(client, tenant_id, result)
    Rails.logger.info("[BankTransactionSync] Starting sync for tenant: #{tenant_id}")
    tenant_result = { success: false, created: 0, updated: 0 }

    begin
      # Fetch all pages of bank transactions
      page = 1
      loop do
        response = client.get("BankTransactions", { page: page, tenant_id: tenant_id })

        unless response[:success]
          result[:errors] << "API error for tenant #{tenant_id} on page #{page}: #{response[:error]}"
          break
        end

        transactions = response.dig(:data, "BankTransactions") || []
        break if transactions.empty?

        result[:pages_fetched] += 1
        result[:total_transactions] += transactions.count

        # Process each transaction
        transactions.each do |txn|
          process_result = process_transaction(txn, tenant_id)
          if process_result[:created]
            result[:created] += 1
            tenant_result[:created] += 1
          elsif process_result[:updated]
            result[:updated] += 1
            tenant_result[:updated] += 1
          elsif process_result[:error]
            result[:errors] << process_result[:error]
          end
        end

        # Check pagination
        pagination = response.dig(:data, "pagination")
        break if pagination.nil? || page >= pagination["pageCount"]

        page += 1

        # Small delay to avoid rate limiting
        sleep(0.5)
      end

      tenant_result[:success] = true
      update_sync_status(tenant_result, tenant_id)

    rescue StandardError => e
      Rails.logger.error("[BankTransactionSync] Failed for tenant #{tenant_id}: #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
      result[:errors] << "Tenant #{tenant_id}: #{e.message}"
    end

    tenant_result
  end

  def process_transaction(txn, tenant_id)
    xero_id = txn["BankTransactionID"]
    return { error: "Missing BankTransactionID" } unless xero_id.present?

    # Skip deleted transactions
    return { skipped: true } if txn["Status"] == "DELETED"

    # Parse date
    date_string = txn["DateString"] || txn["Date"]
    transaction_date = parse_xero_date(date_string)
    return { error: "Invalid date for #{xero_id}" } unless transaction_date

    # Extract line item descriptions
    line_items = txn["LineItems"] || []

    # Resolve xero_contact_id to warehouse_contact_id (SSoT for contact linking)
    xero_contact_id = txn.dig("Contact", "ContactID")
    warehouse_contact = nil
    if xero_contact_id.present?
      warehouse_contact = WarehouseContact.find_by(xero_id: xero_contact_id, tenant_id: tenant_id)
    end

    # Build attributes
    attrs = {
      tenant_id: tenant_id,
      source: "xero",
      bank_account_id: txn.dig("BankAccount", "AccountID"),
      bank_account_code: txn.dig("BankAccount", "Code"),
      bank_account_name: txn.dig("BankAccount", "Name"),
      transaction_type: txn["Type"],
      transaction_date: transaction_date,
      reference: txn["Reference"],
      status: txn["Status"],
      is_reconciled: txn["IsReconciled"] || false,
      xero_contact_id: xero_contact_id,
      warehouse_contact_id: warehouse_contact&.id,
      contact_name: txn.dig("Contact", "Name"),
      sub_total: txn["SubTotal"],
      total_tax: txn["TotalTax"],
      total: txn["Total"],
      currency_code: txn["CurrencyCode"] || "AUD",
      line_items: line_items,
      has_attachments: txn["HasAttachments"] || false,
      xero_updated_at: parse_xero_date(txn["UpdatedDateUTC"]),
      last_synced_at: Time.current
    }

    # Find or create
    record = WarehouseBankTransaction.find_by(xero_id: xero_id)

    if record
      record.update!(attrs)
      { updated: true }
    else
      WarehouseBankTransaction.create!(attrs.merge(xero_id: xero_id))
      { created: true }
    end

  rescue ActiveRecord::RecordInvalid => e
    { error: "Validation error for #{xero_id}: #{e.message}" }
  rescue StandardError => e
    { error: "Error processing #{xero_id}: #{e.message}" }
  end

  def parse_xero_date(date_input)
    return nil unless date_input.present?

    if date_input.is_a?(String)
      if date_input.start_with?("/Date(")
        # Parse Xero's /Date(timestamp)/ format
        timestamp = date_input.match(/\/Date\((\d+)/)&.captures&.first
        return Time.at(timestamp.to_i / 1000).to_date if timestamp
      else
        # Try parsing ISO format
        return Date.parse(date_input) rescue nil
      end
    end

    nil
  end

  # Update sync status for a specific tenant
  def update_sync_status(tenant_result, tenant_id)
    return unless tenant_id.present?

    records_synced = (tenant_result[:created] || 0) + (tenant_result[:updated] || 0)

    if tenant_result[:success]
      XeroSyncStatus.complete_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        records_synced: records_synced,
        next_sync_at: 6.hours.from_now
      )
    else
      XeroSyncStatus.fail_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        error: tenant_result[:error] || "Unknown error"
      )
    end
  end
end
