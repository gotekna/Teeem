# frozen_string_literal: true

# Multi-tenancy Phase 1: Create TenantSetting model
# Replaces the singleton CorporateCompanySetting with per-tenant settings
class CreateTenantSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :tenant_settings do |t|
      t.references :corporate_group, null: false, foreign_key: true, index: { unique: true }

      # Company Info
      t.string :company_name
      t.string :abn
      t.string :acn
      t.string :qbcc_license

      # Localization
      t.string :timezone, default: 'Australia/Brisbane'
      t.string :locale, default: 'en-AU'
      t.string :currency, default: 'AUD'

      # Branding (override CorporateGroup if set here)
      t.string :logo_url
      t.string :primary_color
      t.string :secondary_color
      t.string :accent_color
      t.string :favicon_url

      # Contact
      t.string :address
      t.string :phone
      t.string :email
      t.string :website

      # Billing
      t.string :billing_email
      t.text :billing_address
      t.string :stripe_customer_id

      # Defaults
      t.bigint :default_job_type_id
      t.bigint :default_job_status_id
      t.bigint :default_job_stage_id

      # SaaS linkage (links to Contact who owns this tenant)
      t.bigint :saas_customer_contact_id

      t.timestamps
    end

    add_index :tenant_settings, :stripe_customer_id
    add_index :tenant_settings, :saas_customer_contact_id
    add_foreign_key :tenant_settings, :contacts, column: :saas_customer_contact_id
  end
end
