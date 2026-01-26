# frozen_string_literal: true

# SSoT Fix: Add Activity tab to Contact EntityTabs
#
# The Activity tab was hardcoded in the frontend (contacts/[id]/page.tsx)
# but missing from the EntityTabs database. This migration adds it as the SSoT.
#
# FRC Analysis:
# - Why 1: Activity tab missing from Entity Config admin UI
# - Why 2: Tab was never seeded in the database
# - Why 3: Original seed migration (20251223015208) didn't include it
# - Why 4: Frontend had hardcoded fallback, masking the gap
# - Why 5: No validation that frontend tabs match database tabs
#
# Root Cause: Initial seed migration incomplete, frontend fallback masked issue
# Fix: Add Activity tab to EntityTabs database (SSoT)
#
class AddActivityTabToContacts < ActiveRecord::Migration[8.0]
  def up
    # Add Activity tab to contact scope
    EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'activity') do |tab|
      tab.display_name = 'Activity'
      tab.description = 'Change history and audit log'
      tab.tab_group = 'main'
      tab.order_position = 12  # After directorships
      tab.icon_name = 'History'
      tab.component_name = 'ContactActivityTab'
      tab.enabled = true
      tab.is_system_tab = true
      # SSoT: Always visible (no visibility_rule needed)
    end

    puts "[AddActivityTabToContacts] Added Activity tab to contact scope"
  end

  def down
    EntityTab.find_by(scope: 'contact', tab_key: 'activity')&.destroy
  end
end
