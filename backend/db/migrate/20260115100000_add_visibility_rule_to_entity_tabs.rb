# frozen_string_literal: true

# Add visibility_rule to EntityTab for documenting when tabs are shown/hidden
#
# This is a human-readable description of the condition that controls tab visibility.
# Examples:
#   "Always visible"
#   "Has Xero links"
#   "Has Xero links AND is supplier"
#   "Has linked company"
#
# These rules are displayed in the Entity Tabs config UI to help admins understand
# when each tab will appear for end users.
#
class AddVisibilityRuleToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :visibility_rule, :string

    reversible do |dir|
      dir.up do
        # Set visibility rules for Contact scope tabs
        contact_rules = {
          'overview' => 'Always visible',
          'coms' => 'Always visible',
          'pricebook' => 'Always visible',
          'portal' => 'Always visible',
          'emails' => 'Always visible',
          'financial' => 'Always visible',
          'bills' => 'Has Xero links AND is supplier',
          'invoices' => 'Has Xero links',
          'documents' => 'Always visible',
          'tax' => 'Always visible',
          'photo-id' => 'Always visible',
          'corporate' => 'Has linked company',
          'cases' => 'Always visible',
          'activity' => 'Always visible',
        }

        contact_rules.each do |tab_key, rule|
          EntityTab.where(scope: 'contact', tab_key: tab_key).update_all(visibility_rule: rule)
        end

        # Set visibility rules for Job scope tabs
        job_rules = {
          'overview' => 'Always visible',
          'schedule' => 'Always visible',
          'gantt' => 'Always visible',
          'documents' => 'Always visible',
          'plans' => 'Always visible',
          'checklist' => 'Always visible',
          'financial' => 'Always visible',
          'activity' => 'Always visible',
        }

        job_rules.each do |tab_key, rule|
          EntityTab.where(scope: 'job', tab_key: tab_key).update_all(visibility_rule: rule)
        end

        # Set visibility rules for Corporate scope tabs (always visible - entity_filters control types)
        EntityTab.where(scope: 'corporate_entity').update_all(visibility_rule: 'Always visible (filtered by entity type)')
      end
    end
  end
end
