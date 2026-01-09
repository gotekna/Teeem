class XeroPaymentSyncService
  attr_reader :payment

  def initialize(payment)
    @payment = payment
    @client = XeroApiClient.new
  end

  # Sync payment to Xero
  # Creates a payment against the Xero invoice linked to the PO
  def sync_to_xero
    begin
      # Validate we have what we need
      unless payment.purchase_order.xero_invoice_id.present?
        return {
          success: false,
          error: "Purchase order is not linked to a Xero invoice"
        }
      end

      # Build Xero payment payload
      payment_data = build_xero_payment_data

      # Create payment in Xero
      result = @client.post("Payments", { Payments: [ payment_data ] })

      if result[:success] && result[:data]["Payments"]
        xero_payment = result[:data]["Payments"].first

        # Mark payment as synced
        payment.mark_synced!(xero_payment["PaymentID"])

        Rails.logger.info("Payment #{payment.id} synced to Xero: #{xero_payment['PaymentID']}")

        {
          success: true,
          xero_payment_id: xero_payment["PaymentID"],
          message: "Payment synced to Xero successfully"
        }
      else
        error_message = extract_error_message(result)
        payment.mark_sync_failed!(error_message)

        {
          success: false,
          error: error_message
        }
      end

    rescue XeroApiClient::AuthenticationError => e
      error_msg = "Xero authentication error: #{e.message}"
      payment.mark_sync_failed!(error_msg)
      Rails.logger.error(error_msg)

      {
        success: false,
        error: "Not authenticated with Xero. Please reconnect."
      }

    rescue StandardError => e
      error_msg = "Unexpected error syncing payment: #{e.message}"
      payment.mark_sync_failed!(error_msg)
      Rails.logger.error(error_msg)
      Rails.logger.error(e.backtrace.first(5).join("\n"))

      {
        success: false,
        error: error_msg
      }
    end
  end

  # Fetch payment from Xero by ID
  def fetch_from_xero(xero_payment_id)
    result = @client.get("Payments/#{xero_payment_id}")

    if result[:success]
      result[:data]["Payments"]&.first
    else
      nil
    end
  end

  private

  def build_xero_payment_data
    {
      Invoice: {
        InvoiceID: payment.purchase_order.xero_invoice_id
      },
      Account: {
        Code: payment_account_code
      },
      Date: payment.payment_date.iso8601,
      Amount: payment.amount.to_f,
      Reference: payment.reference_number || "Payment for PO #{payment.purchase_order.purchase_order_number}"
    }
  end

  def payment_account_code
    # Default to bank account
    # You can make this configurable later
    # For now, Xero will use the default bank account
    # Return nil to let Xero use default
    nil
  end

  def extract_error_message(result)
    if result[:data] && result[:data]["Message"]
      result[:data]["Message"]
    elsif result[:error]
      result[:error]
    else
      "Unknown error occurred"
    end
  end
end
