# frozen_string_literal: true

# Seed email EntityTabs for live folder tree feature
#
# This migration creates EntityTab records for the email scope:
# - scope='email', tab_key='overview', storage_folder_path='Emails'
# - scope='email', tab_key='email-body', storage_folder_path='Email Body'
# - scope='email', tab_key='attachments', storage_folder_path='Attachments'
#
# Without these tabs:
# - EntityTab.scope_base_folders won't include { "email" => "Emails" }
# - Frontend can't detect the email scope from folder paths
# - live_folder_tree feature won't work for emails
#
# Uses find_or_create_by! so it's idempotent and safe to run multiple times.
class SeedEmailEntityTabs < ActiveRecord::Migration[7.1]
  def up
    # Overview/root tab - defines the base folder for email scope
    # SSoT: storage_folder_path on overview tab = scope base folder
    EntityTab.find_or_create_by!(scope: 'email', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'Mail'
      tab.has_storage_folder = true
      tab.storage_folder_path = 'Emails'
    end

    # Document folder tabs for email storage
    email_document_tabs = [
      { tab_key: 'email-body', display_name: 'Email Body', icon: 'FileText', folder: 'Email Body' },
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' }
    ]

    email_document_tabs.each_with_index do |attrs, idx|
      EntityTab.find_or_create_by!(scope: 'email', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.has_storage_folder = true
        tab.storage_folder_path = attrs[:folder]
      end
    end

    Rails.logger.info "[Migration] Seeded #{EntityTab.where(scope: 'email').count} email EntityTabs"

    # Fix SSoT conflict: warehouse/email-attachments should NOT map to "Emails"
    # The email scope owns the "Emails" folder via its overview tab
    # This prevents scope lookup ambiguity when frontend calls getScopeFromPath("Emails")
    conflicting_tab = EntityTab.find_by(scope: 'warehouse', tab_key: 'email-attachments')
    if conflicting_tab&.storage_folder_path == 'Emails'
      conflicting_tab.update!(has_storage_folder: false, storage_folder_path: nil)
      Rails.logger.info "[Migration] Fixed SSoT conflict: disabled warehouse/email-attachments storage folder"
    end
  end

  def down
    # Remove email tabs (reversible)
    EntityTab.where(scope: 'email', tab_key: %w[overview email-body attachments]).destroy_all
  end
end
