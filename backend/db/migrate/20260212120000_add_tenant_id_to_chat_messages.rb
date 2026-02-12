# frozen_string_literal: true

# Step 1 of Cross-Tenant Chat: Add tenant_id to chat_messages
#
# ChatMessage was the only major model missing tenant scoping.
# This adds the column and backfills from user.tenant_id.
#
# Why: Chat needs tenant_id for:
#   1. Proper multi-tenancy isolation (defense-in-depth)
#   2. Future cross-tenant chat (Teeem support, guest links)
#   3. Warehouse storage scoping for chat attachments
#
class AddTenantIdToChatMessages < ActiveRecord::Migration[7.1]
  def up
    add_reference :chat_messages, :tenant, foreign_key: true, null: true, index: true

    # Backfill tenant_id from user's tenant
    execute <<-SQL
      UPDATE chat_messages
      SET tenant_id = users.tenant_id
      FROM users
      WHERE chat_messages.user_id = users.id
        AND chat_messages.tenant_id IS NULL
        AND users.tenant_id IS NOT NULL
    SQL
  end

  def down
    remove_reference :chat_messages, :tenant
  end
end
