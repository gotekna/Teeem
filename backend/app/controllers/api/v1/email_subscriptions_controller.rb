# frozen_string_literal: true

module Api
  module V1
    class EmailSubscriptionsController < ApplicationController
      before_action :set_subscription, only: [:show, :update, :add_mailbox, :remove_mailbox,
                                               :start_migration, :cancel, :send_invite,
                                               :add_alias, :remove_alias,
                                               :dns_records, :provision_dns, :verify_dns]

      # GET /api/v1/email_subscriptions
      # List all email subscriptions (admin)
      def index
        subscriptions = EmailSubscription
                         .includes(:contact, :email_mailboxes)
                         .order(created_at: :desc)

        subscriptions = subscriptions.where(status: params[:status]) if params[:status].present?
        subscriptions = subscriptions.limit(params[:limit] || 100)

        render json: {
          success: true,
          data: subscriptions.map { |s| subscription_json(s) }
        }
      end

      # GET /api/v1/email_subscriptions/:id
      # Get subscription details
      def show
        render json: {
          success: true,
          data: subscription_detail_json(@subscription)
        }
      end

      # POST /api/v1/email_subscriptions
      # Create new subscription
      def create
        contact = Contact.find(params[:contact_id])

        subscription = EmailSubscription.new(
          contact: contact,
          domain: params[:domain],
          plan_type: params[:plan_type] || "standard",
          billing_email: params[:billing_email] || contact.email,
          notes: params[:notes],
          created_by: current_user
        )

        # Add mailboxes if provided
        if params[:mailboxes].present?
          params[:mailboxes].each do |mb|
            subscription.email_mailboxes.build(
              email_address: mb[:email],
              display_name: mb[:display_name],
              mailbox_type: mb[:type] || "user",
              source_email: mb[:source_email]
            )
          end
        end

        if subscription.save
          # Queue DNS provisioning if Cloudflare is configured
          if CloudflareCredential.configured?
            EmailDnsProvisionJob.perform_later(subscription.id)
            subscription.update!(dns_status: 'provisioning')
          end

          render json: {
            success: true,
            data: subscription_detail_json(subscription)
          }, status: :created
        else
          render json: {
            success: false,
            error: subscription.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/email_subscriptions/:id
      # Update subscription
      def update
        if @subscription.update(subscription_params)
          render json: {
            success: true,
            data: subscription_detail_json(@subscription)
          }
        else
          render json: {
            success: false,
            error: @subscription.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/email_subscriptions/:id/add_mailbox
      # Add a mailbox to subscription
      def add_mailbox
        mailbox = @subscription.email_mailboxes.build(
          email_address: params[:email],
          display_name: params[:display_name],
          mailbox_type: params[:type] || "user",
          source_email: params[:source_email],
          storage_quota_gb: params[:quota_gb] || 50
        )

        if mailbox.save
          # Provision if subscription is active
          mailbox.provision! if @subscription.active?

          render json: {
            success: true,
            data: mailbox_json(mailbox)
          }, status: :created
        else
          render json: {
            success: false,
            error: mailbox.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/email_subscriptions/:id/remove_mailbox/:mailbox_id
      # Remove a mailbox from subscription
      def remove_mailbox
        mailbox = @subscription.email_mailboxes.find(params[:mailbox_id])
        mailbox.update!(status: "deleted")

        # Update Stripe subscription if active
        if @subscription.stripe_subscription_id.present?
          StripeSubscriptionService.new.update_subscription(@subscription)
        end

        @subscription.sync_mailbox_count!

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Mailbox not found" }, status: :not_found
      end

      # POST /api/v1/email_subscriptions/:id/start_migration
      # Start migration for all or specific mailboxes
      def start_migration
        mailbox_ids = params[:mailbox_ids]

        mailboxes = if mailbox_ids.present?
                      @subscription.email_mailboxes.where(id: mailbox_ids)
                    else
                      @subscription.email_mailboxes.active
                    end

        migrations = []
        service = EmailMigrationService.new(@subscription)

        mailboxes.each do |mailbox|
          next if mailbox.email_migrations.active.exists?

          migration = service.start_migration(mailbox, options: {
            initiated_by: current_user,
            self_service: false
          })
          migrations << migration
        end

        render json: {
          success: true,
          data: {
            started: migrations.count,
            migrations: migrations.map { |m| migration_json(m) }
          }
        }
      rescue EmailMigrationService::MigrationError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/email_subscriptions/:id/cancel
      # Cancel subscription
      def cancel
        at_period_end = params[:at_period_end] != false

        if @subscription.stripe_subscription_id.present?
          StripeSubscriptionService.new.cancel_subscription(@subscription, at_period_end: at_period_end)
        end

        @subscription.update!(
          status: at_period_end ? "cancelling" : "cancelled",
          cancelled_at: Time.current,
          cancelled_by: current_user
        )

        render json: {
          success: true,
          data: subscription_json(@subscription)
        }
      end

      # POST /api/v1/email_subscriptions/:id/add_alias
      # Add an email alias
      def add_alias
        alias_address = params[:alias_address]&.strip
        target_address = params[:target_address]&.strip

        # If target is just username, append domain
        target_address = "#{target_address}@#{@subscription.domain}" unless target_address&.include?("@")

        email_alias = @subscription.email_aliases.build(
          alias_address: alias_address,
          target_address: target_address
        )

        if email_alias.save
          render json: {
            success: true,
            data: alias_json(email_alias)
          }, status: :created
        else
          render json: {
            success: false,
            error: email_alias.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/email_subscriptions/:id/remove_alias/:alias_id
      # Remove an email alias
      def remove_alias
        email_alias = @subscription.email_aliases.find(params[:alias_id])
        email_alias.destroy!

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Alias not found" }, status: :not_found
      end

      # POST /api/v1/email_subscriptions/:id/send_invite
      # Send migration invite to client
      def send_invite
        pricing = EmailPricingService.new
        pricing_result = pricing.calculate_subscription(
          mailboxes: @subscription.email_mailboxes.map { |m| { type: m.mailbox_type, count: 1 } }
        )

        invite = EmailMigrationInvite.create!(
          email_subscription: @subscription,
          contact: @subscription.contact,
          created_by: current_user,
          total_monthly: pricing_result[:retail],
          mailboxes_data: @subscription.email_mailboxes.map do |m|
            {
              email: m.email_address,
              type: m.mailbox_type,
              price: pricing.retail_price(m.mailbox_type)
            }
          end
        )

        # TODO: Send email notification
        Rails.logger.info "[EmailSubscriptions] Created invite #{invite.token} for subscription #{@subscription.id}"

        render json: {
          success: true,
          data: {
            invite: invite_json(invite),
            portal_url: invite.portal_url
          }
        }
      end

      # GET /api/v1/email_subscriptions/dashboard_stats
      # Get dashboard statistics
      def dashboard_stats
        active_subs = EmailSubscription.active
        all_mailboxes = EmailMailbox.joins(:email_subscription).where(email_subscriptions: { status: 'active' })

        render json: {
          success: true,
          data: {
            active_subscriptions: active_subs.count,
            total_mailboxes: all_mailboxes.count,
            monthly_revenue: active_subs.sum(:monthly_retail_amount).to_f,
            margin_percentage: calculate_margin_percentage(active_subs),
            pending_migrations: EmailMigration.pending.count,
            active_migrations: EmailMigration.in_progress.count,
            completed_migrations_today: EmailMigration.completed.where("completed_at >= ?", Date.current.beginning_of_day).count
          }
        }
      end

      # GET /api/v1/email_subscriptions/active_migrations
      # Get currently active migrations
      def active_migrations
        migrations = EmailMigration.active
                      .includes(email_mailbox: { email_subscription: :contact })
                      .order(started_at: :desc)
                      .limit(10)

        render json: {
          success: true,
          data: migrations.map { |m| active_migration_json(m) }
        }
      end

      # GET /api/v1/email_subscriptions/profit_report
      # Get profit/margin report
      def profit_report
        period_start = params[:start_date]&.to_date || Date.current.beginning_of_month
        period_end = params[:end_date]&.to_date || Date.current.end_of_month

        invoices = EmailSubscriptionInvoice
                    .includes(email_subscription: :contact)
                    .where(billing_period_start: period_start..period_end)
                    .paid

        total_retail = invoices.sum(:retail_amount)
        total_wholesale = invoices.sum(:wholesale_amount)
        total_margin = total_retail - total_wholesale

        render json: {
          success: true,
          data: {
            period: {
              start: period_start,
              end: period_end
            },
            summary: {
              total_retail: total_retail.to_f,
              total_wholesale: total_wholesale.to_f,
              total_margin: total_margin.to_f,
              margin_percent: total_retail.positive? ? (total_margin / total_retail * 100).round(1) : 0,
              invoice_count: invoices.count,
              subscription_count: invoices.distinct.count(:email_subscription_id)
            },
            by_subscription: invoices.group_by(&:email_subscription).map do |sub, invs|
              {
                subscription_id: sub.id,
                domain: sub.domain,
                contact: sub.contact.display_name,
                retail: invs.sum(&:retail_amount).to_f,
                wholesale: invs.sum(&:wholesale_amount).to_f,
                margin: invs.sum(&:margin_amount).to_f
              }
            end
          }
        }
      end

      # GET /api/v1/email_subscriptions/discover_mailboxes
      # Discover mailboxes from O365 for a contact
      def discover_mailboxes
        contact = Contact.find(params[:contact_id])

        # Create temp subscription for discovery
        temp_subscription = EmailSubscription.new(contact: contact)
        service = EmailMigrationService.new(temp_subscription)

        mailboxes = service.discover_source_mailboxes

        render json: {
          success: true,
          data: {
            mailboxes: mailboxes,
            count: mailboxes.count
          }
        }
      rescue EmailMigrationService::MigrationError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # GET /api/v1/email_subscriptions/pricing
      # Get pricing information
      def pricing
        pricing = EmailPricingService.new

        if params[:mailboxes].present?
          result = pricing.calculate_subscription(
            mailboxes: params[:mailboxes].map { |m| m.permit(:type, :count, :email, :price).to_h.symbolize_keys }
          )
          render json: { success: true, data: result }
        else
          render json: { success: true, data: pricing.price_list }
        end
      end

      # GET /api/v1/email_subscriptions/:id/dns_records
      # Get DNS records and their status for a subscription
      def dns_records
        records = @subscription.email_dns_records.order(:name)

        render json: {
          success: true,
          data: {
            dns_status: @subscription.dns_status,
            domain: @subscription.domain,
            records: records.map { |r| dns_record_json(r) },
            cloudflare_configured: CloudflareCredential.configured?
          }
        }
      end

      # POST /api/v1/email_subscriptions/:id/provision_dns
      # Re-provision DNS records for a subscription
      def provision_dns
        unless CloudflareCredential.configured?
          render json: {
            success: false,
            error: "Cloudflare not configured. Please set up Cloudflare credentials first."
          }, status: :unprocessable_entity
          return
        end

        # Queue DNS provisioning job
        EmailDnsProvisionJob.perform_later(@subscription.id)
        @subscription.update!(dns_status: 'provisioning')

        render json: {
          success: true,
          data: {
            message: "DNS provisioning queued",
            dns_status: @subscription.dns_status
          }
        }
      end

      # POST /api/v1/email_subscriptions/:id/verify_dns
      # Verify DNS records are correct
      def verify_dns
        unless CloudflareCredential.configured?
          render json: {
            success: false,
            error: "Cloudflare not configured"
          }, status: :unprocessable_entity
          return
        end

        # Run verification synchronously for immediate feedback
        cloudflare = CloudflareService.new
        result = cloudflare.verify_email_dns(@subscription.domain)

        # Update record statuses
        @subscription.email_dns_records.each do |record|
          verified = result[:verified].find { |r| r[:name] == record.name && r[:type] == record.record_type }
          missing = result[:missing].find { |r| r[:name] == record.name && r[:type] == record.record_type }
          incorrect = result[:incorrect].find { |r| r[:name] == record.name && r[:type] == record.record_type }

          if verified
            record.mark_verified!
          elsif missing
            record.mark_missing!
          elsif incorrect
            record.update!(
              status: :error,
              error_message: "Expected: #{incorrect[:expected_content]}, Actual: #{incorrect[:actual_content]}"
            )
          end
        end

        # Update subscription dns_status
        dns_status = case result[:status]
                     when :verified then 'verified'
                     when :missing then 'missing'
                     else 'error'
                     end
        @subscription.update!(dns_status: dns_status)

        render json: {
          success: true,
          data: {
            status: result[:status],
            verified: result[:verified].count,
            missing: result[:missing].count,
            incorrect: result[:incorrect].count,
            dns_status: @subscription.dns_status
          }
        }
      rescue CloudflareService::ZoneNotFoundError => e
        @subscription.update!(dns_status: 'zone_not_found')
        render json: {
          success: false,
          error: "Domain zone not found in Cloudflare: #{@subscription.domain}"
        }, status: :unprocessable_entity
      rescue CloudflareService::ApiError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      private

      def set_subscription
        @subscription = EmailSubscription.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Subscription not found" }, status: :not_found
      end

      def subscription_params
        params.permit(:domain, :plan_type, :billing_email, :notes, :status)
      end

      def subscription_json(sub)
        {
          id: sub.id,
          contact_id: sub.contact_id,
          contact_name: sub.contact.display_name,
          domain: sub.domain,
          status: sub.status,
          dns_status: sub.dns_status,
          plan_type: sub.plan_type,
          mailbox_count: sub.mailbox_count,
          monthly_retail: sub.monthly_retail_amount.to_f,
          monthly_wholesale: sub.monthly_wholesale_amount.to_f,
          margin: sub.margin_amount.to_f,
          current_period_end: sub.current_period_end,
          created_at: sub.created_at
        }
      end

      def subscription_detail_json(sub)
        subscription_json(sub).merge(
          billing_email: sub.billing_email,
          notes: sub.notes,
          stripe_subscription_id: sub.stripe_subscription_id,
          polaris_account_id: sub.polaris_account_id,
          mailboxes: sub.email_mailboxes.map { |m| mailbox_json(m) },
          aliases: sub.email_aliases.active.map { |a| alias_json(a) },
          dns_records: sub.email_dns_records.map { |r| dns_record_json(r) },
          migrations: sub.email_migrations.recent.limit(10).map { |m| migration_json(m) },
          invites: sub.email_migration_invites.recent.limit(5).map { |i| invite_json(i) },
          invoices: sub.email_subscription_invoices.recent.limit(10).map { |i| invoice_json(i) }
        )
      end

      def dns_record_json(record)
        {
          id: record.id,
          record_type: record.record_type,
          name: record.name,
          full_name: record.full_name,
          content: record.content,
          priority: record.priority,
          status: record.status,
          purpose: record.purpose,
          cloudflare_record_id: record.cloudflare_record_id,
          error_message: record.error_message,
          last_verified_at: record.last_verified_at,
          provisioned_at: record.provisioned_at
        }
      end

      def mailbox_json(mb)
        {
          id: mb.id,
          email_address: mb.email_address,
          display_name: mb.display_name,
          mailbox_type: mb.mailbox_type,
          status: mb.status,
          source_email: mb.source_email,
          storage_quota_gb: mb.storage_quota_gb,
          storage_used_gb: mb.storage_used_gb,
          provisioned_at: mb.provisioned_at
        }
      end

      def migration_json(mig)
        {
          id: mig.id,
          mailbox_id: mig.email_mailbox_id,
          source_email: mig.source_email,
          migration_type: mig.migration_type,
          status: mig.status,
          progress: mig.progress_percentage,
          processed_items: mig.processed_items,
          total_items: mig.total_items,
          started_at: mig.started_at,
          completed_at: mig.completed_at,
          error_message: mig.error_message
        }
      end

      def invite_json(inv)
        {
          id: inv.id,
          token: inv.token,
          status: inv.status,
          portal_url: inv.portal_url,
          total_monthly: inv.total_monthly.to_f,
          view_count: inv.view_count,
          expires_at: inv.expires_at,
          created_at: inv.created_at
        }
      end

      def invoice_json(inv)
        {
          id: inv.id,
          billing_period: inv.period_description,
          retail_amount: inv.retail_amount.to_f,
          wholesale_amount: inv.wholesale_amount.to_f,
          margin: inv.margin_amount.to_f,
          status: inv.status,
          stripe_invoice_id: inv.stripe_invoice_id
        }
      end

      def alias_json(email_alias)
        {
          id: email_alias.id,
          alias_address: email_alias.alias_address,
          full_alias: email_alias.full_alias_address,
          target_address: email_alias.target_address,
          alias_type: email_alias.alias_type,
          is_active: email_alias.is_active,
          created_at: email_alias.created_at
        }
      end

      def active_migration_json(mig)
        sub = mig.email_mailbox&.email_subscription
        {
          id: mig.id,
          source_email: mig.source_email,
          contact_name: sub&.contact&.display_name,
          migration_type: mig.migration_type,
          status: mig.status,
          progress: mig.progress_percentage,
          processed_items: mig.processed_items,
          total_items: mig.total_items,
          started_at: mig.started_at
        }
      end

      def calculate_margin_percentage(subscriptions)
        return 0 if subscriptions.empty?

        total_retail = subscriptions.sum(:monthly_retail_amount)
        total_wholesale = subscriptions.sum(:monthly_wholesale_amount)

        return 0 if total_retail.zero?

        ((total_retail - total_wholesale) / total_retail * 100).round(1)
      end
    end
  end
end
