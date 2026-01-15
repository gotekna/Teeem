# frozen_string_literal: true

# Set up parent-child relationships for Contact EntityTabs
#
# Structure:
# - Corporate (parent)
#   - Tax (child)
#   - Photo ID (child)
#   - Directorships (child)
#
# - Financial (parent)
#   - Bank Details (child)
#   - Jobs (child)
#   - Purchase Orders (child)
#
# Note: Invoices and Bills are ROOT tabs (not under Financial)
# They show when contact has Primary Xero links
#
class SetupContactTabHierarchy < ActiveRecord::Migration[8.0]
  def up
    # Find parent tabs
    corporate_tab = EntityTab.find_by(scope: 'contact', tab_key: 'corporate')
    financial_tab = EntityTab.find_by(scope: 'contact', tab_key: 'financial')

    if corporate_tab
      # Set Corporate as parent for Tax, Photo ID, Directorships
      EntityTab.where(scope: 'contact', tab_key: ['tax', 'photo-id', 'directorships'])
               .update_all(parent_id: corporate_tab.id)
      Rails.logger.info "Set Corporate (#{corporate_tab.id}) as parent for Tax, Photo ID, Directorships"
    end

    if financial_tab
      # Set Financial as parent for Bank Details, Jobs, Purchase Orders
      EntityTab.where(scope: 'contact', tab_key: ['bank-details', 'jobs', 'purchase-orders'])
               .update_all(parent_id: financial_tab.id)
      Rails.logger.info "Set Financial (#{financial_tab.id}) as parent for Bank Details, Jobs, Purchase Orders"
    end

    # Ensure Invoices and Bills are ROOT tabs (no parent)
    EntityTab.where(scope: 'contact', tab_key: ['invoices', 'bills'])
             .update_all(parent_id: nil)
    Rails.logger.info "Ensured Invoices and Bills are root tabs"
  end

  def down
    # Remove all parent relationships for contact tabs
    EntityTab.where(scope: 'contact', tab_key: ['tax', 'photo-id', 'directorships', 'bank-details', 'jobs', 'purchase-orders'])
             .update_all(parent_id: nil)
  end
end
