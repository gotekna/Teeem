module Gl
  class RecurringInvoice < ApplicationRecord
    self.table_name = 'gl_recurring_invoices'

    # Associations
    belongs_to :contact, optional: true
    belongs_to :job, optional: true
    belongs_to :created_by, class_name: 'User', optional: true
    belongs_to :updated_by, class_name: 'User', optional: true
    has_many :generated_invoices, class_name: 'Gl::Invoice', foreign_key: :recurring_invoice_id

    # Validations
    validates :name, presence: true
    validates :invoice_type, presence: true, inclusion: { in: %w[sales_invoice bill] }
    validates :frequency, presence: true, inclusion: { in: %w[daily weekly fortnightly monthly quarterly annually] }
    validates :frequency_interval, numericality: { greater_than: 0 }
    validates :start_date, presence: true
    validates :day_of_month, numericality: { greater_than_or_equal_to: -1, less_than_or_equal_to: 28 }, allow_nil: true
    validates :day_of_week, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 6 }, allow_nil: true
    validate :end_date_after_start_date, if: -> { end_date.present? }
    validate :line_items_template_valid

    # Scopes
    scope :active, -> { where(is_active: true, status: 'active') }
    scope :paused, -> { where(status: 'paused') }
    scope :due_for_generation, -> { active.where('next_generation_date <= ?', Date.current) }
    scope :sales_invoices, -> { where(invoice_type: 'sales_invoice') }
    scope :bills, -> { where(invoice_type: 'bill') }

    # Callbacks
    before_create :set_next_generation_date
    before_save :calculate_totals_from_template

    # Constants
    FREQUENCIES = {
      'daily' => 1.day,
      'weekly' => 1.week,
      'fortnightly' => 2.weeks,
      'monthly' => 1.month,
      'quarterly' => 3.months,
      'annually' => 1.year
    }.freeze

    # Instance methods
    def generate_invoice!
      return nil unless can_generate?

      invoice = nil
      transaction do
        invoice = build_invoice_from_template
        invoice.save!

        # Update tracking
        self.occurrences_count += 1
        self.last_generated_at = Time.current
        self.next_generation_date = calculate_next_date

        # Check if completed
        if reached_limit? || past_end_date?
          self.status = 'completed'
          self.is_active = false
        end

        save!

        # Auto-approve if configured
        if auto_approve && invoice.may_approve?
          invoice.approve!(created_by)
        end

        # Send email if configured
        if send_email_on_generation && email_to.present?
          RecurringInvoiceMailer.invoice_generated(invoice, email_to, email_cc).deliver_later
        end
      end

      invoice
    end

    def can_generate?
      return false unless is_active && status == 'active'
      return false if next_generation_date.nil? || next_generation_date > Date.current
      return false if reached_limit?
      return false if past_end_date?
      true
    end

    def reached_limit?
      occurrences_limit.present? && occurrences_count >= occurrences_limit
    end

    def past_end_date?
      end_date.present? && Date.current > end_date
    end

    def pause!
      update!(status: 'paused', is_active: false)
    end

    def resume!
      # Recalculate next date if it's in the past
      new_next_date = next_generation_date
      while new_next_date && new_next_date < Date.current
        new_next_date = calculate_next_date(from_date: new_next_date)
      end
      update!(status: 'active', is_active: true, next_generation_date: new_next_date)
    end

    def cancel!
      update!(status: 'cancelled', is_active: false)
    end

    def frequency_description
      interval = frequency_interval == 1 ? '' : "#{frequency_interval} "
      case frequency
      when 'daily' then "Every #{interval}day#{'s' if frequency_interval > 1}"
      when 'weekly' then "Every #{interval}week#{'s' if frequency_interval > 1}"
      when 'fortnightly' then 'Every 2 weeks'
      when 'monthly' then "Every #{interval}month#{'s' if frequency_interval > 1}"
      when 'quarterly' then "Every #{interval}quarter#{'s' if frequency_interval > 1}"
      when 'annually' then "Every #{interval}year#{'s' if frequency_interval > 1}"
      else frequency
      end
    end

    def remaining_occurrences
      return nil unless occurrences_limit
      [occurrences_limit - occurrences_count, 0].max
    end

    private

    def set_next_generation_date
      self.next_generation_date ||= start_date
    end

    def calculate_next_date(from_date: next_generation_date)
      return nil if from_date.nil?

      base_date = from_date
      interval = frequency_interval || 1

      new_date = case frequency
      when 'daily'
        base_date + interval.days
      when 'weekly'
        base_date + interval.weeks
      when 'fortnightly'
        base_date + (interval * 2).weeks
      when 'monthly'
        next_monthly_date(base_date, interval)
      when 'quarterly'
        base_date + (interval * 3).months
      when 'annually'
        base_date + interval.years
      else
        base_date + 1.month
      end

      new_date
    end

    def next_monthly_date(from_date, interval)
      target_date = from_date + interval.months

      if day_of_month.present?
        if day_of_month == -1
          # Last day of month
          target_date.end_of_month
        else
          # Specific day, but don't exceed month length
          day = [day_of_month, target_date.end_of_month.day].min
          Date.new(target_date.year, target_date.month, day)
        end
      else
        target_date
      end
    end

    def build_invoice_from_template
      invoice = Gl::Invoice.new(
        invoice_type: invoice_type,
        invoice_date: Date.current,
        due_date: Date.current + (payment_terms_days || 14).days,
        contact_id: contact_id,
        contact_name: contact_name || contact&.name,
        job_id: job_id,
        description: description,
        notes: notes,
        currency_code: currency_code,
        exchange_rate: exchange_rate,
        status: 'draft',
        recurring_invoice_id: id,
        recurring_sequence: occurrences_count + 1,
        created_in_teeem: true
      )

      # Build lines from template
      (line_items_template || []).each_with_index do |line_data, index|
        invoice.lines.build(
          line_number: index + 1,
          item_code: line_data['item_code'],
          description: line_data['description'],
          quantity: line_data['quantity'] || 1,
          unit_price: line_data['unit_price'] || 0,
          discount_percent: line_data['discount_percent'] || 0,
          tax_type: line_data['tax_type'],
          tax_rate: line_data['tax_rate'] || 0,
          account_code: line_data['account_code'],
          job_id: job_id
        )
      end

      invoice
    end

    def calculate_totals_from_template
      lines = line_items_template || []

      self.subtotal = lines.sum do |line|
        qty = (line['quantity'] || 1).to_d
        price = (line['unit_price'] || 0).to_d
        discount = (line['discount_percent'] || 0).to_d
        line_total = qty * price
        line_total -= (line_total * discount / 100) if discount > 0
        line_total
      end

      self.total_tax = lines.sum do |line|
        qty = (line['quantity'] || 1).to_d
        price = (line['unit_price'] || 0).to_d
        discount = (line['discount_percent'] || 0).to_d
        tax_rate = (line['tax_rate'] || 0).to_d
        line_total = qty * price
        line_total -= (line_total * discount / 100) if discount > 0
        line_total * tax_rate / 100
      end

      self.total = subtotal + total_tax
    end

    def end_date_after_start_date
      if end_date <= start_date
        errors.add(:end_date, 'must be after start date')
      end
    end

    def line_items_template_valid
      return if line_items_template.blank?

      unless line_items_template.is_a?(Array)
        errors.add(:line_items_template, 'must be an array')
        return
      end

      line_items_template.each_with_index do |line, index|
        unless line.is_a?(Hash)
          errors.add(:line_items_template, "line #{index + 1} must be an object")
          next
        end

        if line['description'].blank?
          errors.add(:line_items_template, "line #{index + 1} must have a description")
        end
      end
    end
  end
end
