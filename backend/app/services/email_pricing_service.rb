# frozen_string_literal: true

# EmailPricingService - Pricing and margin calculations for email hosting
#
# Handles wholesale costs, retail pricing, and margin calculations for
# the PolarisMail reseller business.
#
# Pricing Model (default):
#   User Mailbox:   $3/mo wholesale → $6/mo retail (100% markup)
#   Shared Mailbox: $1.50/mo wholesale → $3/mo retail (100% markup)
#   Extra Storage:  $0.05/GB wholesale → $0.10/GB retail (100% markup)
#
# Usage:
#   pricing = EmailPricingService.new
#   pricing.calculate_subscription(mailboxes: [
#     { type: "user", count: 5 },
#     { type: "shared", count: 2 }
#   ])
#   # => { wholesale: 16.50, retail: 33.00, margin: 16.50, margin_pct: 50 }
#
class EmailPricingService
  # Default wholesale costs (from PolarisMail)
  DEFAULT_WHOLESALE = {
    "user" => 3.00,
    "shared" => 1.50,
    "resource" => 1.00,
    "storage_per_gb" => 0.05
  }.freeze

  # Default markup percentage (100% = double the wholesale price)
  DEFAULT_MARKUP_PERCENT = 100

  def initialize(markup_percent: nil)
    @markup_percent = markup_percent || ENV.fetch("EMAIL_MARKUP_PERCENT", DEFAULT_MARKUP_PERCENT).to_f
  end

  # Calculate pricing for a subscription
  # @param mailboxes [Array<Hash>] List of { type:, count: } or { type:, email:, price: }
  # @param extra_storage_gb [Integer] Additional storage beyond default
  # @return [Hash] Pricing breakdown
  def calculate_subscription(mailboxes:, extra_storage_gb: 0)
    wholesale_total = 0.0
    retail_total = 0.0
    breakdown = []

    mailboxes.each do |mailbox|
      if mailbox[:count]
        # Aggregate format: { type: "user", count: 5 }
        count = mailbox[:count].to_i
        type = mailbox[:type] || "user"
        wholesale = wholesale_price(type) * count
        retail = retail_price(type) * count

        wholesale_total += wholesale
        retail_total += retail
        breakdown << {
          type: type,
          count: count,
          wholesale: wholesale.round(2),
          retail: retail.round(2)
        }
      else
        # Individual format: { email: "user@example.com", type: "user", price: 6.00 }
        type = mailbox[:type] || "user"
        custom_price = mailbox[:price]&.to_f
        wholesale = wholesale_price(type)
        retail = custom_price || retail_price(type)

        wholesale_total += wholesale
        retail_total += retail
        breakdown << {
          email: mailbox[:email],
          type: type,
          wholesale: wholesale.round(2),
          retail: retail.round(2)
        }
      end
    end

    # Extra storage charges
    if extra_storage_gb.positive?
      storage_wholesale = extra_storage_gb * wholesale_price("storage_per_gb")
      storage_retail = extra_storage_gb * retail_price("storage_per_gb")
      wholesale_total += storage_wholesale
      retail_total += storage_retail
      breakdown << {
        type: "extra_storage",
        gb: extra_storage_gb,
        wholesale: storage_wholesale.round(2),
        retail: storage_retail.round(2)
      }
    end

    margin = retail_total - wholesale_total
    margin_pct = retail_total.positive? ? (margin / retail_total * 100) : 0

    {
      wholesale: wholesale_total.round(2),
      retail: retail_total.round(2),
      margin: margin.round(2),
      margin_percent: margin_pct.round(1),
      breakdown: breakdown
    }
  end

  # Get wholesale price for a mailbox type
  # @param type [String] Mailbox type: user, shared, resource, storage_per_gb
  # @return [Float] Monthly wholesale cost
  def wholesale_price(type)
    DEFAULT_WHOLESALE.fetch(type.to_s, DEFAULT_WHOLESALE["user"])
  end

  # Get retail price for a mailbox type (with markup)
  # @param type [String] Mailbox type
  # @return [Float] Monthly retail price
  def retail_price(type)
    wholesale = wholesale_price(type)
    (wholesale * (1 + @markup_percent / 100.0)).round(2)
  end

  # Calculate margin for given wholesale/retail amounts
  # @param wholesale [Float] Wholesale cost
  # @param retail [Float] Retail price
  # @return [Hash] Margin details
  def calculate_margin(wholesale:, retail:)
    margin = retail - wholesale
    margin_pct = retail.positive? ? (margin / retail * 100) : 0

    {
      wholesale: wholesale.round(2),
      retail: retail.round(2),
      margin: margin.round(2),
      margin_percent: margin_pct.round(1)
    }
  end

  # Generate pricing summary for display
  # @return [Hash] Price list
  def price_list
    {
      user_mailbox: {
        wholesale: wholesale_price("user"),
        retail: retail_price("user"),
        description: "Standard user mailbox (50GB)"
      },
      shared_mailbox: {
        wholesale: wholesale_price("shared"),
        retail: retail_price("shared"),
        description: "Shared team mailbox"
      },
      resource_mailbox: {
        wholesale: wholesale_price("resource"),
        retail: retail_price("resource"),
        description: "Resource mailbox (room/equipment)"
      },
      extra_storage: {
        wholesale: wholesale_price("storage_per_gb"),
        retail: retail_price("storage_per_gb"),
        description: "Additional storage per GB/month"
      },
      markup_percent: @markup_percent
    }
  end

  # Estimate annual revenue and profit
  # @param monthly_retail [Float] Monthly retail revenue
  # @param monthly_wholesale [Float] Monthly wholesale cost
  # @return [Hash] Annual projections
  def annual_projection(monthly_retail:, monthly_wholesale:)
    annual_retail = monthly_retail * 12
    annual_wholesale = monthly_wholesale * 12
    annual_margin = annual_retail - annual_wholesale

    {
      monthly: {
        revenue: monthly_retail.round(2),
        cost: monthly_wholesale.round(2),
        profit: (monthly_retail - monthly_wholesale).round(2)
      },
      annual: {
        revenue: annual_retail.round(2),
        cost: annual_wholesale.round(2),
        profit: annual_margin.round(2)
      }
    }
  end
end
