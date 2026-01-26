# frozen_string_literal: true

# Seed task EntityTabs for live folder tree feature
#
# This migration creates EntityTab records for the task scope:
# - scope='task', tab_key='overview', storage_folder_path='Tasks'
# - scope='task', tab_key='attachments', storage_folder_path='Attachments'
# - scope='task', tab_key='responses', storage_folder_path='Responses'
#
# Without these tabs:
# - EntityTab.scope_base_folders won't include { "task" => "Tasks" }
# - Frontend can't detect the task scope from folder paths
# - live_folder_tree feature won't work for tasks
#
# Uses find_or_create_by! so it's idempotent and safe to run multiple times.
class SeedTaskEntityTabs < ActiveRecord::Migration[7.1]
  def up
    # Overview/root tab - defines the base folder for task scope
    # SSoT: storage_folder_path on overview tab = scope base folder
    EntityTab.find_or_create_by!(scope: 'task', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'ClipboardList'
      tab.has_storage_folder = true
      tab.storage_folder_path = 'Tasks'
    end

    # Document folder tabs for task storage
    task_document_tabs = [
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' },
      { tab_key: 'responses', display_name: 'Responses', icon: 'MessageSquare', folder: 'Responses' }
    ]

    task_document_tabs.each_with_index do |attrs, idx|
      EntityTab.find_or_create_by!(scope: 'task', tab_key: attrs[:tab_key]) do |tab|
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

    Rails.logger.info "[Migration] Seeded #{EntityTab.where(scope: 'task').count} task EntityTabs"
  end

  def down
    # Remove task tabs (reversible)
    EntityTab.where(scope: 'task', tab_key: %w[overview attachments responses]).destroy_all
  end
end
