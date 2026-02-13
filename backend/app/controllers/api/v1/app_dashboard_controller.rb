module Api
  module V1
    class AppDashboardController < ApplicationController
      # GET /api/v1/app_dashboard/stats
      # Returns real-time stats for the main app dashboard
      def stats
        today = TenantSetting.today
        year_start = today.beginning_of_year

        # Active Jobs
        active_jobs_count = Job.active.count
        jobs_this_week = Job.active.where("jobs.created_at >= ?", today.beginning_of_week).count
        jobs_trend = jobs_this_week > 0 ? "+#{jobs_this_week} this week" : "No new this week"

        # Pending POs
        pending_pos_count = PurchaseOrder.pending_approval.count
        overdue_pos_count = PurchaseOrder.overdue.count

        # Revenue YTD (from paid sales invoices)
        revenue_ytd = ExternalInvoice.sales_invoices.active
          .where("invoice_date >= ?", year_start)
          .sum(:total).to_f

        # Revenue trend: compare YTD this year vs same period last year
        last_year_start = (year_start - 1.year)
        last_year_same_day = today - 1.year
        revenue_last_year = ExternalInvoice.sales_invoices.active
          .where(invoice_date: last_year_start..last_year_same_day)
          .sum(:total).to_f

        revenue_trend_pct = if revenue_last_year > 0
          (((revenue_ytd - revenue_last_year) / revenue_last_year) * 100).round(0)
        else
          0
        end

        # Contacts
        total_contacts = Contact.active.count
        contacts_this_month = Contact.active.where("contacts.created_at >= ?", today.beginning_of_month).count
        contacts_trend = contacts_this_month > 0 ? "+#{contacts_this_month} this month" : "No new this month"

        render json: {
          success: true,
          data: {
            activeJobs: active_jobs_count,
            activeJobsTrend: jobs_trend,
            pendingPos: pending_pos_count,
            overduePos: overdue_pos_count,
            revenueYtd: revenue_ytd,
            revenueTrendPct: revenue_trend_pct,
            totalContacts: total_contacts,
            contactsTrend: contacts_trend
          }
        }
      end

      # GET /api/v1/app_dashboard/activity
      # Returns the 10 most recent notable events
      def activity
        today = TenantSetting.today
        cutoff = 14.days.ago

        events = []

        # Recent PO status changes (approved/sent)
        PurchaseOrder.where("updated_at >= ?", cutoff)
          .where(status: %w[approved sent])
          .order(updated_at: :desc)
          .limit(5)
          .each do |po|
            events << {
              type: po.status == "approved" ? "po_approved" : "po_sent",
              title: "#{po.purchase_order_number} #{po.status}",
              time: po.updated_at,
              icon: "check_circle"
            }
          end

        # Recent jobs created
        Job.where("jobs.created_at >= ?", cutoff)
          .order(created_at: :desc)
          .limit(5)
          .each do |job|
            events << {
              type: "job_created",
              title: "#{job.job_code} created",
              time: job.created_at,
              icon: "briefcase"
            }
          end

        # Recent contacts added
        Contact.active.where("contacts.created_at >= ?", cutoff)
          .order(created_at: :desc)
          .limit(5)
          .each do |contact|
            events << {
              type: "contact_added",
              title: "#{contact.display_name} added",
              time: contact.created_at,
              icon: "users"
            }
          end

        # Sort all events by time, take most recent 10
        sorted = events.sort_by { |e| e[:time] }.reverse.first(10)

        render json: {
          success: true,
          data: sorted.map { |e|
            {
              type: e[:type],
              title: e[:title],
              time: e[:time].iso8601,
              timeAgo: time_ago_in_words(e[:time]),
              icon: e[:icon]
            }
          }
        }
      end

      # GET /api/v1/app_dashboard/upcoming
      # Returns upcoming tasks, PO deadlines, and overdue invoices
      def upcoming
        today = TenantSetting.today
        week_end = today.end_of_week
        items = []

        # SM Tasks due this week
        SmTask.active
          .where(end_date: today..week_end)
          .order(end_date: :asc)
          .limit(5)
          .each do |task|
            items << {
              type: "task",
              title: task.name,
              date: task.end_date.iso8601,
              dateLabel: format_upcoming_date(task.end_date, today),
              category: "Task"
            }
          end

        # POs with upcoming required_date
        PurchaseOrder.where(status: %w[pending approved sent])
          .where(required_date: today..(today + 7.days))
          .order(required_date: :asc)
          .limit(5)
          .each do |po|
            items << {
              type: "po_deadline",
              title: "#{po.purchase_order_number} due",
              date: po.required_date.iso8601,
              dateLabel: format_upcoming_date(po.required_date, today),
              category: "Deadline"
            }
          end

        # Overdue invoices
        ExternalInvoice.sales_invoices.active
          .where("due_date < ? AND amount_due > 0", today)
          .order(due_date: :asc)
          .limit(5)
          .each do |inv|
            items << {
              type: "invoice_overdue",
              title: "#{inv.invoice_number} overdue",
              date: inv.due_date.iso8601,
              dateLabel: "Overdue #{(today - inv.due_date).to_i} days",
              category: "Payment"
            }
          end

        # Sort by date, take first 8
        sorted = items.sort_by { |i| i[:date] }.first(8)

        render json: {
          success: true,
          data: sorted
        }
      end

      private

      def time_ago_in_words(time)
        diff = Time.current - time
        case diff
        when 0..59 then "just now"
        when 60..3599 then "#{(diff / 60).round} min ago"
        when 3600..86399 then "#{(diff / 3600).round} hours ago"
        when 86400..172799 then "Yesterday"
        else "#{(diff / 86400).round} days ago"
        end
      end

      def format_upcoming_date(date, today)
        if date == today
          "Today"
        elsif date == today + 1.day
          "Tomorrow"
        elsif date <= today.end_of_week
          date.strftime("%A")
        else
          date.strftime("%-d %b")
        end
      end
    end
  end
end
