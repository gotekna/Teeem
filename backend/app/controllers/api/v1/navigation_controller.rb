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
        position = 0

        # IMAP accounts for current user
        current_user.imap_credentials.where(is_active: true).each do |cred|
          accounts << {
            id: "imap_#{cred.id}",
            name: cred.email_address || cred.name,
            href: "/email?account=#{cred.id}",
            icon: "mail",
            badge_key: nil,
            position: position += 1,
            has_children: false,
            children: []
          }
        end

        # MS365 org accounts (with user mailbox access)
        OrganizationMicrosoftAppCredential.connected.each do |org_cred|
          user_mailbox_access = org_cred.sync_config&.dig("user_mailbox_access") || {}
          user_emails = user_mailbox_access[current_user.id.to_s] || []

          user_emails.each do |email|
            accounts << {
              id: "ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}",
              name: email,
              href: "/email?account=ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}",
              icon: "mail",
              badge_key: nil,
              position: position += 1,
              has_children: false,
              children: []
            }
          end
        end

        accounts
      end
    end
  end
end
