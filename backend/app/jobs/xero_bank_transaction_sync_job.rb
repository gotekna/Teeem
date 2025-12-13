class XeroBankTransactionSyncJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("Starting XeroBankTransactionSyncJob")

    result = {
      created: 0,
      updated: 0,
      errors: [],
      pages_fetched: 0,
      total_transactions: 0
    }

    begin
      client = XeroApiClient.new
      credential = XeroCredential.current

      unless credential.present?
        Rails.logger.warn("No valid Xero connection")
        return result
      end

      tenant_id = credential.tenant_id

      # Fetch all pages of bank transactions
      page = 1
      loop do
        response = client.get("BankTransactions", { page: page })

        unless response[:success]
          result[:errors] << "API error on page #{page}: #{response[:error]}"
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
          elsif process_result[:updated]
            result[:updated] += 1
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

      # Update sync status (global and per-tenant)
      update_sync_status(result, tenant_id)

    rescue StandardError => e
      Rails.logger.error("XeroBankTransactionSyncJob failed: #{e.message}")
      Rails.logger.error(e.backtrace.first(10).join("\n"))
      result[:errors] << e.message
    end

    Rails.logger.info("XeroBankTransactionSyncJob completed: #{result.inspect}")
    result
  end

  private

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
      xero_contact_id: txn.dig("Contact", "ContactID"),
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

  def update_sync_status(result, tenant_id = nil)
    # Update global status
    status = XeroSyncStatus.find_or_initialize_by(sync_type: "bank_transactions", tenant_id: nil)
    status.update!(
      last_synced_at: Time.current,
      next_sync_at: 6.hours.from_now, # Sync every 6 hours
      status: result[:errors].empty? ? "success" : "partial",
      records_synced: result[:created] + result[:updated],
      last_error: result[:errors].first
    )

    # Also update per-tenant status (for self-healing to work)
    if tenant_id.present?
      tenant_status = XeroSyncStatus.find_or_initialize_by(sync_type: "bank_transactions", tenant_id: tenant_id)
      tenant_status.update!(
        last_synced_at: Time.current,
        next_sync_at: 6.hours.from_now,
        status: result[:errors].empty? ? "success" : "partial",
        records_synced: result[:created] + result[:updated],
        last_error: result[:errors].first
      )
    end
  end
end
