# frozen_string_literal: true

module Api
  module V1
    # MigratePortalController - Public token-based migration portal
    #
    # Handles the self-service email migration flow:
    # 1. Client opens invite link (/migrate/:token)
    # 2. Reviews mailboxes and pricing
    # 3. Sets up Stripe subscription
    # 4. Monitors migration progress
    #
    # No authentication required - secured by token
    #
    class MigratePortalController < ApplicationController
      skip_before_action :authorize_request
      before_action :set_invite, only: [:show, :create_subscription, :progress, :confirm_migration]

      # GET /api/v1/migrate/:token
      # Get invite details for display
      def show
        @invite.record_view!
        @invite.check_expiry!

        subscription = @invite.email_subscription
        contact = @invite.contact
        pricing = EmailPricingService.new

        render json: {
          success: true,
          data: {
            invite: {
              token: @invite.token,
              status: @invite.status,
              expires_at: @invite.expires_at,
              expired: @invite.expired?,
              can_pay: @invite.can_pay?,
              payment_complete: @invite.payment_complete?,
              total_monthly: @invite.total_monthly.to_f
            },
            subscription: {
              id: subscription.id,
              domain: subscription.domain,
              status: subscription.status
            },
            contact: {
              name: contact.display_name,
              email: contact.email,
              company: contact.company_name
            },
            mailboxes: @invite.mailboxes_data || subscription.email_mailboxes.map { |m|
              {
                email: m.email_address,
                display_name: m.display_name,
                type: m.mailbox_type,
                price: pricing.retail_price(m.mailbox_type)
              }
            },
            pricing: {
              price_list: pricing.price_list,
              monthly_total: @invite.total_monthly.to_f
            }
          }
        }
      end

      # POST /api/v1/migrate/:token/subscribe
      # Create Stripe subscription checkout session
      def create_subscription
        unless @invite.can_pay?
          message = if @invite.expired?
                      "This invite has expired"
                    elsif @invite.payment_complete?
                      "Payment has already been completed"
                    else
                      "This invite is not valid for payment"
                    end
          return render json: { success: false, error: message }, status: :unprocessable_entity
        end

        subscription = @invite.email_subscription
        stripe_service = StripeSubscriptionService.new

        # Determine return URLs
        frontend_url = ENV.fetch("FRONTEND_URL", "https://teeem.vercel.app")
        success_url = "#{frontend_url}/migrate/#{@invite.token}?payment=success"
        cancel_url = "#{frontend_url}/migrate/#{@invite.token}?payment=cancelled"

        session = stripe_service.create_checkout_session(
          email_subscription: subscription,
          success_url: success_url,
          cancel_url: cancel_url
        )

        @invite.mark_payment_pending!

        render json: {
          success: true,
          data: {
            checkout_url: session.url,
            session_id: session.id
          }
        }
      rescue StripeSubscriptionService::SubscriptionError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue Stripe::StripeError => e
        Rails.logger.error("[MigratePortal] Stripe error: #{e.message}")
        render json: { success: false, error: "Payment service unavailable" }, status: :service_unavailable
      end

      # GET /api/v1/migrate/:token/progress
      # Get migration progress
      def progress
        subscription = @invite.email_subscription
        migrations = subscription.email_migrations.recent

        render json: {
          success: true,
          data: {
            invite_status: @invite.status,
            subscription_status: subscription.status,
            migrations: migrations.map { |m| migration_progress_json(m) },
            overall: calculate_overall_progress(migrations)
          }
        }
      end

      # POST /api/v1/migrate/:token/confirm
      # Confirm and start migration after payment
      def confirm_migration
        unless @invite.payment_complete?
          return render json: {
            success: false,
            error: "Payment must be completed before migration can start"
          }, status: :unprocessable_entity
        end

        subscription = @invite.email_subscription
        service = EmailMigrationService.new(subscription)

        # Start migrations for all mailboxes
        migrations = service.queue_all_migrations(options: {
          self_service: true,
          initiated_by: nil
        })

        @invite.start_migration!

        render json: {
          success: true,
          data: {
            started: migrations.count,
            message: "Migration started for #{migrations.count} mailboxes"
          }
        }
      rescue EmailMigrationService::MigrationError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/migrate/webhook
      # Handle Stripe subscription webhooks
      def webhook
        payload = request.body.read
        sig_header = request.env["HTTP_STRIPE_SIGNATURE"]
        endpoint_secret = ENV["STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"] || ENV["STRIPE_WEBHOOK_SECRET"]

        unless endpoint_secret
          Rails.logger.warn("[MigratePortal] Webhook secret not configured")
          return head :ok
        end

        begin
          event = Stripe::Webhook.construct_event(payload, sig_header, endpoint_secret)
        rescue Stripe::SignatureVerificationError => e
          Rails.logger.error("[MigratePortal] Webhook signature failed: #{e.message}")
          return render json: { error: "Invalid signature" }, status: :bad_request
        end

        # Handle subscription events
        case event.type
        when "checkout.session.completed"
          handle_checkout_completed(event.data.object)
        when "invoice.paid"
          handle_invoice_paid(event.data.object)
        when "invoice.payment_failed"
          handle_invoice_failed(event.data.object)
        when "customer.subscription.deleted"
          handle_subscription_cancelled(event.data.object)
        else
          Rails.logger.info("[MigratePortal] Unhandled event: #{event.type}")
        end

        head :ok
      end

      private

      def set_invite
        @invite = EmailMigrationInvite.find_by!(token: params[:token])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invite not found or expired" }, status: :not_found
      end

      def migration_progress_json(migration)
        {
          id: migration.id,
          email: migration.source_email,
          status: migration.status,
          progress: migration.progress_percentage,
          processed: migration.processed_items,
          total: migration.total_items,
          failed: migration.failed_items,
          started_at: migration.started_at,
          completed_at: migration.completed_at,
          duration_minutes: migration.duration_minutes,
          error: migration.error_message
        }
      end

      def calculate_overall_progress(migrations)
        return { percent: 0, status: "pending" } if migrations.empty?

        total_items = migrations.sum(:total_items)
        processed_items = migrations.sum(:processed_items)

        statuses = migrations.pluck(:status)
        overall_status = if statuses.all? { |s| s == "completed" }
                           "completed"
                         elsif statuses.any? { |s| s == "failed" }
                           "failed"
                         elsif statuses.any? { |s| s == "in_progress" }
                           "in_progress"
                         else
                           "pending"
                         end

        {
          percent: total_items.positive? ? (processed_items.to_f / total_items * 100).round(1) : 0,
          status: overall_status,
          total_mailboxes: migrations.count,
          completed_mailboxes: migrations.completed.count
        }
      end

      def handle_checkout_completed(session)
        # Find subscription by checkout session
        subscription = EmailSubscription.find_by(stripe_checkout_session_id: session.id)
        return unless subscription

        # Update subscription with Stripe details
        stripe_service = StripeSubscriptionService.new
        stripe_service.handle_checkout_complete(session.id)

        # Update invite status
        invite = subscription.email_migration_invites.active.first
        invite&.mark_payment_complete!

        Rails.logger.info("[MigratePortal] Checkout completed for subscription #{subscription.id}")
      end

      def handle_invoice_paid(invoice)
        stripe_service = StripeSubscriptionService.new
        stripe_service.handle_invoice_paid(invoice)
      end

      def handle_invoice_failed(invoice)
        stripe_service = StripeSubscriptionService.new
        stripe_service.handle_invoice_failed(invoice)
      end

      def handle_subscription_cancelled(subscription)
        stripe_service = StripeSubscriptionService.new
        stripe_service.handle_subscription_cancelled(subscription.id)
      end
    end
  end
end
