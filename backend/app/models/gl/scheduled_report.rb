# frozen_string_literal: true

module Gl
  # Schedules reports to be generated and emailed automatically
  class ScheduledReport < ApplicationRecord
    self.table_name = "gl_scheduled_reports"

    REPORT_TYPES = %w[
      profit_loss
      balance_sheet
      trial_balance
      aged_receivables
      aged_payables
      cash_flow
      gst_summary
      bank_reconciliation
      job_costing
    ].freeze

    FREQUENCIES = %w[daily weekly monthly quarterly].freeze
    FORMATS = %w[pdf csv excel].freeze

    belongs_to :corporate_company
    belongs_to :created_by, class_name: "User", optional: true

    validates :name, presence: true
    validates :report_type, presence: true, inclusion: { in: REPORT_TYPES }
    validates :frequency, presence: true, inclusion: { in: FREQUENCIES }
    validates :format, presence: true, inclusion: { in: FORMATS }
    validates :day_of_week, inclusion: { in: 0..6 }, allow_nil: true
    validates :day_of_month, inclusion: { in: 1..31 }, allow_nil: true

    validate :validate_recipients

    scope :active, -> { where(active: true) }
    scope :due_now, -> { active.where("next_send_at <= ?", Time.current) }

    before_save :calculate_next_send_at, if: :schedule_changed?

    def recipients_array
      return [] if recipients.blank?

      JSON.parse(recipients)
    rescue JSON::ParserError
      recipients.to_s.split(",").map(&:strip)
    end

    def recipients_array=(emails)
      self.recipients = emails.to_json
    end

    # Generate and send the report
    def generate_and_send!
      return unless active?

      begin
        # Generate the report
        report_data = generate_report

        # Send email with attachment
        ScheduledReportMailer.deliver_report(self, report_data).deliver_later

        update!(
          last_sent_at: Time.current,
          send_count: send_count + 1,
          last_error: nil
        )

        calculate_next_send_at
        save!

        true
      rescue StandardError => e
        update!(last_error: e.message)
        Rails.logger.error("[ScheduledReport] Failed to send report #{id}: #{e.message}")
        false
      end
    end

    def generate_report
      # Generate report based on type
      case report_type
      when "profit_loss"
        generate_profit_loss
      when "balance_sheet"
        generate_balance_sheet
      when "trial_balance"
        generate_trial_balance
      when "aged_receivables"
        generate_aged_receivables
      when "aged_payables"
        generate_aged_payables
      when "cash_flow"
        generate_cash_flow
      when "gst_summary"
        generate_gst_summary
      when "bank_reconciliation"
        generate_bank_reconciliation
      when "job_costing"
        generate_job_costing
      else
        raise "Unknown report type: #{report_type}"
      end
    end

    def pause!
      update!(active: false)
    end

    def resume!
      calculate_next_send_at
      update!(active: true, next_send_at: next_send_at)
    end

    private

    def schedule_changed?
      frequency_changed? || day_of_week_changed? || day_of_month_changed? || send_at_changed?
    end

    def calculate_next_send_at
      now = TenantSetting.now
      send_time = send_at || Time.zone.parse("08:00")

      base_time = now.change(hour: send_time.hour, min: send_time.min)

      self.next_send_at = case frequency
                          when "daily"
                            base_time <= now ? base_time + 1.day : base_time
                          when "weekly"
                            next_weekday(base_time, day_of_week || 1)
                          when "monthly"
                            next_month_day(base_time, day_of_month || 1)
                          when "quarterly"
                            next_quarter_day(base_time, day_of_month || 1)
                          else
                            base_time + 1.day
                          end
    end

    def next_weekday(base_time, target_day)
      days_ahead = target_day - base_time.wday
      days_ahead += 7 if days_ahead <= 0 || (days_ahead == 0 && base_time <= Time.current)
      base_time + days_ahead.days
    end

    def next_month_day(base_time, target_day)
      target = base_time.change(day: [target_day, base_time.end_of_month.day].min)
      target <= Time.current ? target + 1.month : target
    end

    def next_quarter_day(base_time, target_day)
      # Quarters: Jan, Apr, Jul, Oct
      quarter_months = [1, 4, 7, 10]
      current_quarter = quarter_months.select { |m| m <= base_time.month }.last || 10

      target = base_time.change(month: current_quarter, day: [target_day, 28].min)
      if target <= Time.current
        next_quarter = quarter_months.find { |m| m > current_quarter } || 1
        year = next_quarter == 1 ? base_time.year + 1 : base_time.year
        target = Time.zone.local(year, next_quarter, [target_day, 28].min, send_at.hour, send_at.min)
      end
      target
    end

    def validate_recipients
      return if recipients.blank?

      emails = recipients_array
      return errors.add(:recipients, "must have at least one email") if emails.empty?

      invalid = emails.reject { |e| e.match?(URI::MailTo::EMAIL_REGEXP) }
      errors.add(:recipients, "contains invalid emails: #{invalid.join(', ')}") if invalid.any?
    end

    # Report generation methods
    def generate_profit_loss
      period = parameters["period"] || "this_month"
      Gl::ReportGenerator.profit_loss(corporate_company, period: period, format: format)
    end

    def generate_balance_sheet
      as_of = parameters["as_of"] || Date.current.to_s
      Gl::ReportGenerator.balance_sheet(corporate_company, as_of: as_of, format: format)
    end

    def generate_trial_balance
      as_of = parameters["as_of"] || Date.current.to_s
      Gl::ReportGenerator.trial_balance(corporate_company, as_of: as_of, format: format)
    end

    def generate_aged_receivables
      as_of = parameters["as_of"] || Date.current.to_s
      Gl::ReportGenerator.aged_receivables(corporate_company, as_of: as_of, format: format)
    end

    def generate_aged_payables
      as_of = parameters["as_of"] || Date.current.to_s
      Gl::ReportGenerator.aged_payables(corporate_company, as_of: as_of, format: format)
    end

    def generate_cash_flow
      period = parameters["period"] || "this_month"
      Gl::ReportGenerator.cash_flow(corporate_company, period: period, format: format)
    end

    def generate_gst_summary
      period = parameters["period"] || "this_quarter"
      Gl::ReportGenerator.gst_summary(corporate_company, period: period, format: format)
    end

    def generate_bank_reconciliation
      account_id = parameters["bank_account_id"]
      Gl::ReportGenerator.bank_reconciliation(corporate_company, account_id: account_id, format: format)
    end

    def generate_job_costing
      job_id = parameters["job_id"]
      Gl::ReportGenerator.job_costing(corporate_company, job_id: job_id, format: format)
    end
  end
end
