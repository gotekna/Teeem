module Api
  module V1
    class NavigationController < ApplicationController
      # GET /api/v1/navigation
      # Returns navigation from SSoT (NavigationItem) with user's collapse preferences
      def index
        # Sync user's collapse prefs for any new items added by admin
        UserNavigationConfig.sync_for_user(current_user)

        # Get user's collapse preferences
        collapse_prefs = current_user.user_navigation_configs
                           .pluck(:navigation_item_id, :is_collapsed)
                           .to_h

        # Get items from SSoT (NavigationItem), ordered by admin-set position
        # Eager load 2 levels of children to avoid N+1 queries
        items = NavigationItem.active.top_level.ordered
                  .includes(children: :children)
                  .select { |item| item.visible_to?(current_user) }

        render json: {
          success: true,
          navigation: {
            items: items.map { |item| item_with_children_json(item, collapse_prefs) }
          }
        }
      end

      # PATCH /api/v1/navigation/:id/toggle_collapse
      # Toggle user's collapse preference for a navigation item
      def toggle_collapse
        config = current_user.user_navigation_configs.find_or_create_by!(
          navigation_item_id: params[:id]
        ) do |c|
          # Set default from NavigationItem if creating new
          c.is_collapsed = NavigationItem.find(params[:id]).is_collapsed_default
        end

        config.update!(is_collapsed: !config.is_collapsed)
        render json: { success: true, is_collapsed: config.is_collapsed }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Navigation item not found" }, status: :not_found
      end

      # POST /api/v1/navigation/reset
      # Reset user's collapse preferences to system defaults
      def reset
        UserNavigationConfig.reset_for_user(current_user)
        render json: { success: true }
      end

      # GET /api/v1/navigation/email_accounts
      # Get email accounts with their ordering (IMAP + MS365)
      def email_accounts
        accounts = []
        saved_positions = current_user.email_nav_positions || {}
        fallback_position = 1000  # High number for unsorted items

        # IMAP accounts for current user (owned + shared)
        # SSoT: accessible_by returns owned OR shared_with_user_ids contains user
        ImapCredential.accessible_by(current_user).where(is_active: true).each do |cred|
          account_id = cred.id.to_s
          accounts << {
            id: cred.id,
            type: "imap",
            name: cred.email_address || cred.name,
            nav_position: saved_positions[account_id] || (fallback_position += 1)
          }
        end

        # MS365 accounts (from sync_config user_mailbox_access)
        MicrosoftCredential.app_credentials.connected.each do |org_cred|
          user_mailbox_access = org_cred.sync_config&.dig("user_mailbox_access") || {}
          configured_emails = user_mailbox_access[current_user.id.to_s] || []

          # Auto-include user's own email if it exists in this tenant
          tenant_emails = org_cred.list_tenant_users.map { |u| u[:email]&.downcase }.compact
          auto_emails = if current_user.email.present? && tenant_emails.include?(current_user.email.downcase)
            [current_user.email]
          else
            []
          end

          (auto_emails + configured_emails).uniq.compact.each do |email|
            next if email.blank?
            account_id = "ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}"
            accounts << {
              id: account_id,
              type: "ms365",
              name: email,
              org_name: org_cred.name,
              nav_position: saved_positions[account_id] || (fallback_position += 1)
            }
          end
        end

        # Sort by saved position
        accounts.sort_by! { |a| a[:nav_position] }

        render json: { success: true, email_accounts: accounts }
      end

      # POST /api/v1/navigation/reorder_email_accounts
      # Reorder email accounts (saves positions for IMAP + MS365)
      def reorder_email_accounts
        email_positions = {}

        params[:accounts].each_with_index do |account, index|
          account_id = account[:id].to_s
          account_type = account[:type]

          if account_type == "imap"
            # IMAP: save to nav_position column
            ImapCredential.where(id: account_id, user_id: current_user.id)
                         .update_all(nav_position: index)
          end

          # All accounts: save position to user's email_nav_positions JSON
          email_positions[account_id] = index
        end

        # Save all positions to user (works for both IMAP and MS365)
        current_user.update!(email_nav_positions: email_positions)

        render json: { success: true }
      end

      private

      def item_with_children_json(item, collapse_prefs)
        # Get visible children, ordered by position
        visible_children = item.children.active.ordered.select { |child| child.visible_to?(current_user) }

        # User's collapse preference, or default from NavigationItem
        is_collapsed = collapse_prefs.key?(item.id) ? collapse_prefs[item.id] : item.is_collapsed_default

        # Inject email accounts as children for Email nav item
        email_account_children = []
        if item.href == "/email"
          email_account_children = build_email_account_nav_items
        end

        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: item.position,
          is_collapsed: is_collapsed,
          has_children: visible_children.any? || email_account_children.any?,
          children: visible_children.map { |child| child_item_json(child, collapse_prefs) } + email_account_children
        }
      end

      def child_item_json(child, collapse_prefs)
        # Get visible grandchildren, ordered by position (supports 2 levels of nesting)
        visible_grandchildren = child.children.active.ordered.select { |gc| gc.visible_to?(current_user) }
        is_collapsed = collapse_prefs.key?(child.id) ? collapse_prefs[child.id] : child.is_collapsed_default

        {
          id: child.id,
          name: child.name,
          href: child.href,
          icon: child.icon,
          badge_key: child.badge_key,
          position: child.position,
          is_collapsed: is_collapsed,
          has_children: visible_grandchildren.any?,
          children: visible_grandchildren.map { |gc| grandchild_item_json(gc) }
        }
      end

      def grandchild_item_json(grandchild)
        # Grandchildren are the final level - no deeper nesting
        {
          id: grandchild.id,
          name: grandchild.name,
          href: grandchild.href,
          icon: grandchild.icon,
          badge_key: grandchild.badge_key,
          position: grandchild.position
        }
      end

      def build_email_account_nav_items
        accounts = []
        saved_positions = current_user.email_nav_positions || {}
        fallback_position = 1000  # High number for unsorted items

        # IMAP accounts for current user (owned + shared)
        # SSoT: accessible_by returns owned OR shared_with_user_ids contains user
        ImapCredential.accessible_by(current_user).where(is_active: true).each do |cred|
          account_id = cred.id.to_s
          accounts << {
            id: "imap_#{cred.id}",
            name: cred.email_address || cred.name,
            href: "/email?account=#{cred.id}",
            icon: "mail",
            badge_key: nil,
            position: saved_positions[account_id] || (fallback_position += 1),
            has_children: false,
            children: []
          }
        end

        # MS365 org accounts (with user mailbox access)
        # SSoT: Use MicrosoftCredential for app credentials
        MicrosoftCredential.app_credentials.connected.each do |org_cred|
          user_mailbox_access = org_cred.sync_config&.dig("user_mailbox_access") || {}
          configured_emails = user_mailbox_access[current_user.id.to_s] || []

          # SSoT: Auto-include user's own email ONLY if it exists in this tenant
          tenant_emails = org_cred.list_tenant_users.map { |u| u[:email]&.downcase }.compact
          auto_emails = if current_user.email.present? && tenant_emails.include?(current_user.email.downcase)
            [current_user.email]
          else
            []
          end
          user_emails = (auto_emails + configured_emails).uniq.compact

          user_emails.each do |email|
            next if email.blank?
            account_id = "ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}"
            accounts << {
              id: account_id,
              name: email,
              href: "/email?account=#{account_id}",
              icon: "mail",
              badge_key: nil,
              position: saved_positions[account_id] || (fallback_position += 1),
              has_children: false,
              children: []
            }
          end
        end

        # Sort by saved position
        accounts.sort_by { |a| a[:position] }
      end
    end
  end
end
