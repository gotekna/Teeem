class ComplianceCalendarService
  # Get all compliance items for the calendar view
  # Can be filtered by company_id, company_group_id, date range, status
  def initialize(params = {})
    @company_id = params[:company_id]
    @company_group_id = params[:company_group_id]
    @start_date = params[:start_date] || Date.today.beginning_of_month
    @end_date = params[:end_date] || 6.months.from_now.end_of_month
    @completed = params[:completed]
    @include_completed = params[:include_completed] || false
  end

  def calendar_items
    # Use left outer join to include companies without company_groups
    items = CorporateComplianceItem
      .joins(:company)
      .left_joins(company: :company_group)
      .where("corporate_compliance_items.due_date BETWEEN ? AND ?", @start_date, @end_date)
      .includes(:corporate)

    items = items.where(company_id: @company_id) if @company_id.present?
    items = items.where(companies: { company_group_id: @company_group_id }) if @company_group_id.present?
    items = items.where(completed: @completed) unless @completed.nil?
    items = items.where(completed: false) unless @include_completed

    items.order(:due_date)
  end

  # Get compliance items grouped by date for calendar display
  def items_by_date
    calendar_items.group_by { |item| item.due_date.to_date }
  end

  # Get compliance items grouped by month
  def items_by_month
    calendar_items.group_by { |item| item.due_date.beginning_of_month }
  end

  # Get summary statistics
  def summary
    items = calendar_items

    {
      total: items.count,
      overdue: items.where("corporate_compliance_items.due_date < ?", Date.today).where(completed: false).count,
      due_this_week: items.where("corporate_compliance_items.due_date BETWEEN ? AND ?", Date.today, Date.today.end_of_week).where(completed: false).count,
      due_this_month: items.where("corporate_compliance_items.due_date BETWEEN ? AND ?", Date.today, Date.today.end_of_month).where(completed: false).count,
      pending: items.where(completed: false).count,
      completed: items.where(completed: true).count
    }
  end

  # Get overdue items
  def overdue_items
    CorporateComplianceItem
      .joins(:company)
      .left_joins(company: :company_group)
      .where("corporate_compliance_items.due_date < ? AND corporate_compliance_items.completed = ?", Date.today, false)
      .includes(:corporate)
      .order(:due_date)
  end

  # Get upcoming items (next 30 days)
  def upcoming_items(days = 30)
    CorporateComplianceItem
      .joins(:company)
      .left_joins(company: :company_group)
      .where("corporate_compliance_items.due_date BETWEEN ? AND ? AND corporate_compliance_items.completed = ?", Date.today, days.days.from_now, false)
      .includes(:corporate)
      .order(:due_date)
  end

  # Get items by company for a group-level view
  def items_by_company
    calendar_items.group_by(&:company_id).transform_values do |items|
      {
        company: items.first.company,
        items: items,
        overdue_count: items.count { |i| i.due_date < Date.today && !i.completed },
        pending_count: items.count { |i| !i.completed },
        total_count: items.count
      }
    end
  end

  # Generate recurring compliance items for all companies
  # Call this monthly via a scheduled job
  def self.generate_annual_compliance_items(financial_year: nil)
    fy = financial_year || current_financial_year
    fy_end = Date.new(fy + 1, 6, 30) # FY25 ends 30 June 2025

    generated = 0
    errors = []

    Corporate.active.includes(:company_group).find_each do |company|
      begin
        # ASIC Annual Review - due on anniversary of incorporation
        if company.date_incorporated.present?
          review_month = company.date_incorporated.month
          review_day = company.date_incorporated.day
          # Calculate next review date
          review_year = Date.today.month > review_month || (Date.today.month == review_month && Date.today.day > review_day) ? Date.today.year + 1 : Date.today.year
          review_date = Date.new(review_year, review_month, review_day) rescue Date.new(review_year, review_month, 28)

          unless company.corporate_compliance_items.exists?(item_type: "asic_annual_review", due_date: review_date)
            company.corporate_compliance_items.create!(
              item_type: "asic_annual_review",
              title: "ASIC Annual Review #{review_year}",
              description: "Annual company statement due. Review director details, registered office, and share structure.",
              due_date: review_date + 2.months, # Due 2 months after review date
              completed: false,
              asic_related: true,
              recurrence: "annual"
            )
            generated += 1
          end
        end

        # ATO Tax Return - due 15 May (or Feb for lodge with agent)
        tax_return_due = Date.new(fy + 1, 5, 15) # May after FY end
        unless company.corporate_compliance_items.exists?(item_type: "tax_return", due_date: tax_return_due)
          company.corporate_compliance_items.create!(
            item_type: "tax_return",
            title: "Company Tax Return FY#{fy.to_s[-2..]}",
            description: "Annual company tax return due to ATO.",
            due_date: tax_return_due,
            completed: false,
            ato_related: true,
            recurrence: "annual"
          )
          generated += 1
        end

        # Solvency Declaration - due within 2 months of FY end
        solvency_due = fy_end + 2.months
        unless company.corporate_compliance_items.exists?(item_type: "solvency_declaration", due_date: solvency_due)
          company.corporate_compliance_items.create!(
            item_type: "solvency_declaration",
            title: "Solvency Declaration FY#{fy.to_s[-2..]}",
            description: "Directors' solvency declaration required within 2 months of financial year end.",
            due_date: solvency_due,
            completed: false,
            asic_related: true,
            recurrence: "annual"
          )
          generated += 1
        end

        # GST BAS - if registered for GST
        if company.gst_registration_status == "registered"
          # Quarterly BAS dates for FY (July to June)
          bas_quarters = [
            { quarter: "Q1", period_end: Date.new(fy, 9, 30), due: Date.new(fy, 10, 28) },
            { quarter: "Q2", period_end: Date.new(fy, 12, 31), due: Date.new(fy + 1, 2, 28) },
            { quarter: "Q3", period_end: Date.new(fy + 1, 3, 31), due: Date.new(fy + 1, 4, 28) },
            { quarter: "Q4", period_end: fy_end, due: Date.new(fy + 1, 7, 28) }
          ]

          bas_quarters.each do |bas|
            next if bas[:due] < Date.today # Skip past quarters
            next if company.corporate_compliance_items.exists?(item_type: "bas", due_date: bas[:due])

            company.corporate_compliance_items.create!(
              item_type: "bas",
              title: "BAS #{bas[:quarter]} FY#{fy.to_s[-2..]}",
              description: "Business Activity Statement for period ending #{bas[:period_end].strftime('%d %b %Y')}",
              due_date: bas[:due],
              completed: false,
              ato_related: true,
              recurrence: "quarterly"
            )
            generated += 1
          end
        end
      rescue => e
        errors << { company: company.name, error: e.message }
      end
    end

    { generated: generated, errors: errors }
  end

  def self.current_financial_year
    # FY25 = July 2024 to June 2025, so current year if >= July, previous if < July
    Date.today.month >= 7 ? Date.today.year : Date.today.year - 1
  end

  # Send reminders for upcoming compliance items
  # Call this daily via a scheduled job
  def self.send_reminders(days_before: [ 30, 14, 7, 1 ])
    sent_count = 0

    days_before.each do |days|
      target_date = Date.today + days.days

      items = CorporateComplianceItem
        .where(due_date: target_date, completed: false)
        .where(last_reminder_sent_at: nil)
        .or(CorporateComplianceItem.where(due_date: target_date, completed: false).where("last_reminder_sent_at < ?", 7.days.ago))
        .includes(:corporate)

      items.find_each do |item|
        # Queue email notification
        # ComplianceReminderMailer.reminder(item, days).deliver_later
        item.update(last_reminder_sent_at: Time.current)
        sent_count += 1
        Rails.logger.info "Sent #{days}-day reminder for #{item.company.name}: #{item.title}"
      end
    end

    sent_count
  end
end
