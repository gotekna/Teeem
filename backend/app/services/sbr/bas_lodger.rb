# frozen_string_literal: true

module Sbr
  # Prepares and lodges BAS (Business Activity Statement) to ATO
  #
  # SSoT: This is THE service for BAS lodgement
  #
  # Usage:
  #   lodger = Sbr::BasLodger.new(corporate_company)
  #   result = lodger.lodge(period: "2024-Q1")
  #
  class BasLodger
    class ValidationError < StandardError; end
    class AlreadyLodgedError < StandardError; end

    # BAS period formats
    QUARTERLY_PERIODS = %w[Q1 Q2 Q3 Q4].freeze
    MONTHLY_PERIODS = (1..12).map { |m| "M#{m.to_s.rjust(2, '0')}" }.freeze

    def initialize(corporate_company)
      @company = corporate_company
      @client = Client.new if Client.configured?
    end

    # Preview BAS data without lodging
    def preview(period:, year: Date.current.year)
      validate_period!(period)

      {
        company: company_details,
        period: format_period(period, year),
        period_dates: period_date_range(period, year),
        fields: calculate_bas_fields(period, year),
        calculated_at: Time.current,
        can_lodge: can_lodge?(period, year)
      }
    end

    # Lodge BAS to ATO
    def lodge(period:, year: Date.current.year, amendment: false)
      validate_period!(period)
      validate_can_lodge!(period, year, amendment)

      bas_data = prepare_lodgement(period, year, amendment)

      # Create lodgement record
      lodgement = Gl::BasLodgement.create!(
        corporate_company: @company,
        period_code: period,
        period_year: year,
        status: "pending",
        data: bas_data,
        is_amendment: amendment
      )

      begin
        # Submit to ATO
        response = @client.lodge_bas(build_message(bas_data))

        lodgement.update!(
          status: response[:success] ? "lodged" : "failed",
          lodgement_reference: response[:reference],
          lodged_at: response[:success] ? Time.current : nil,
          error_message: response[:error],
          ato_response: response[:raw]
        )

        lodgement
      rescue StandardError => e
        lodgement.update!(
          status: "error",
          error_message: e.message
        )
        raise
      end
    end

    # Check if SBR is configured
    def self.available?
      Client.configured?
    end

    # Calculate BAS fields from GL data
    def calculate_bas_fields(period, year)
      date_range = period_date_range(period, year)

      {
        # GST Section
        gst: calculate_gst_section(date_range),

        # PAYG Withholding Section
        payg_withholding: calculate_payg_withholding(date_range),

        # PAYG Instalments Section
        payg_instalments: calculate_payg_instalments(date_range),

        # Summary
        net_amount: calculate_net_amount(date_range)
      }
    end

    private

    def validate_period!(period)
      valid = QUARTERLY_PERIODS.include?(period) || MONTHLY_PERIODS.include?(period)
      raise ValidationError, "Invalid period: #{period}. Use Q1-Q4 or M01-M12" unless valid
    end

    def validate_can_lodge!(period, year, amendment)
      raise ValidationError, "SBR not configured" unless Client.configured?
      raise ValidationError, "Company ABN required" unless @company.abn.present?

      existing = Gl::BasLodgement.where(
        corporate_company: @company,
        period_code: period,
        period_year: year,
        status: "lodged"
      ).exists?

      if existing && !amendment
        raise AlreadyLodgedError, "BAS already lodged for #{period} #{year}. Use amendment: true to revise."
      end
    end

    def can_lodge?(period, year)
      return false unless Client.configured?
      return false unless @company.abn.present?

      !Gl::BasLodgement.where(
        corporate_company: @company,
        period_code: period,
        period_year: year,
        status: "lodged"
      ).exists?
    end

    def period_date_range(period, year)
      case period
      when "Q1" then Date.new(year, 7, 1)..Date.new(year, 9, 30)
      when "Q2" then Date.new(year, 10, 1)..Date.new(year, 12, 31)
      when "Q3" then Date.new(year + 1, 1, 1)..Date.new(year + 1, 3, 31)
      when "Q4" then Date.new(year + 1, 4, 1)..Date.new(year + 1, 6, 30)
      when /^M(\d{2})$/
        month = ::Regexp.last_match(1).to_i
        fiscal_year = month >= 7 ? year : year + 1
        Date.new(fiscal_year, month, 1)..Date.new(fiscal_year, month, -1)
      else
        raise ValidationError, "Cannot determine date range for period: #{period}"
      end
    end

    def format_period(period, year)
      "FY#{year}-#{year + 1} #{period}"
    end

    def company_details
      {
        abn: @company.abn,
        name: @company.name,
        trading_name: @company.trading_name
      }
    end

    def calculate_gst_section(date_range)
      # Get GST accounts (SSoT: use account type)
      gst_collected = gst_account("collected")
      gst_paid = gst_account("paid")

      g1 = sum_credits(gst_collected, date_range) # GST on sales
      g10 = sum_debits(gst_paid, date_range)      # GST on purchases
      g11 = g10                                    # Capital purchases (simplified)

      {
        "G1" => g1,                    # Total sales
        "G2" => 0,                     # Export sales (GST-free)
        "G3" => 0,                     # Other GST-free sales
        "G10" => g10,                  # Capital purchases
        "G11" => g11,                  # Non-capital purchases
        "1A" => g1,                    # GST on sales
        "1B" => g10 + g11,             # GST on purchases (credits)
        "1C" => g1 - (g10 + g11)       # Net GST (payable if positive)
      }
    end

    def calculate_payg_withholding(date_range)
      # Get PAYG withholding accounts
      payg_account = liability_account("payg_withholding")

      w1 = sum_credits(payg_account, date_range, reference: "wages")
      w2 = w1 # Simplified - W2 is amount withheld from W1

      {
        "W1" => w1,  # Total salary/wages
        "W2" => w2,  # Amount withheld
        "W3" => 0,   # Other amounts withheld
        "W4" => w2   # Total PAYG withheld
      }
    end

    def calculate_payg_instalments(date_range)
      # PAYG instalments for business income
      revenue = sum_revenue(date_range)

      {
        "T1" => revenue,                          # Instalment income
        "T2" => (revenue * instalment_rate).round(2), # Calculated instalment
        "T7" => 0,                                # Varied amount
        "T8" => 0,                                # Varied rate
        "T9" => (revenue * instalment_rate).round(2)  # Amount payable
      }
    end

    def calculate_net_amount(date_range)
      gst = calculate_gst_section(date_range)
      payg_w = calculate_payg_withholding(date_range)
      payg_i = calculate_payg_instalments(date_range)

      gst["1C"] + payg_w["W4"] + payg_i["T9"]
    end

    def gst_account(type)
      Gl::Account.find_by(
        corporate_company: @company,
        account_type: "gst",
        sub_type: type
      )
    end

    def liability_account(sub_type)
      Gl::Account.find_by(
        corporate_company: @company,
        account_type: "liability",
        sub_type: sub_type
      )
    end

    def sum_credits(account, date_range, reference: nil)
      return 0 unless account

      scope = Gl::LedgerLine
        .where(gl_account: account)
        .where(entry_date: date_range)

      scope = scope.where("reference ILIKE ?", "%#{reference}%") if reference
      scope.sum(:credit).to_d
    end

    def sum_debits(account, date_range)
      return 0 unless account

      Gl::LedgerLine
        .where(gl_account: account)
        .where(entry_date: date_range)
        .sum(:debit).to_d
    end

    def sum_revenue(date_range)
      revenue_accounts = Gl::Account.where(
        corporate_company: @company,
        account_type: "revenue"
      )

      Gl::LedgerLine
        .where(gl_account: revenue_accounts)
        .where(entry_date: date_range)
        .sum(:credit).to_d
    end

    def instalment_rate
      # Default PAYG instalment rate (varies by business)
      # This should come from company settings
      @company.payg_instalment_rate || 0.0
    end

    def prepare_lodgement(period, year, amendment)
      {
        abn: @company.abn,
        period: format_period(period, year),
        period_code: period,
        period_year: year,
        period_dates: period_date_range(period, year),
        is_amendment: amendment,
        fields: calculate_bas_fields(period, year),
        declaration: {
          declarant_name: Current.user&.name || @company.primary_contact_name,
          declarant_role: "Authorised Representative",
          declaration_date: Date.current,
          declaration_text: "I declare that the information provided is true and correct."
        },
        prepared_at: Time.current,
        prepared_by: Current.user&.id
      }
    end

    def build_message(bas_data)
      XbrlBuilder.new(bas_data).build
    end
  end
end
