# frozen_string_literal: true

# Consolidates CorporateCompanySetting into TenantSetting as the SSoT.
# Phase 1: Add missing columns to tenant_settings
# Phase 2: Migrate data from corporate_company_settings (singleton) to tenant_settings
# Phase 3: Drop the old table
class ConsolidateCorporateSettingsToTenantSettings < ActiveRecord::Migration[8.0]
  def up
    # Phase 1: Add missing columns to tenant_settings
    add_column :tenant_settings, :internal_email_domains, :string unless column_exists?(:tenant_settings, :internal_email_domains)
    add_column :tenant_settings, :monitored_mailbox_pay, :string unless column_exists?(:tenant_settings, :monitored_mailbox_pay)
    add_column :tenant_settings, :monitored_mailbox_newtask, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newtask)
    add_column :tenant_settings, :monitored_mailbox_newjob, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newjob)
    add_column :tenant_settings, :monitored_mailbox_newcase, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newcase)
    add_column :tenant_settings, :brand_color_primary, :string unless column_exists?(:tenant_settings, :brand_color_primary)
    add_column :tenant_settings, :brand_color_primary_foreground, :string unless column_exists?(:tenant_settings, :brand_color_primary_foreground)
    add_column :tenant_settings, :brand_color_secondary, :string unless column_exists?(:tenant_settings, :brand_color_secondary)
    add_column :tenant_settings, :brand_color_muted, :string unless column_exists?(:tenant_settings, :brand_color_muted)
    add_column :tenant_settings, :brand_color_accent, :string unless column_exists?(:tenant_settings, :brand_color_accent)
    add_column :tenant_settings, :api_environment, :string, default: "production" unless column_exists?(:tenant_settings, :api_environment)
    add_column :tenant_settings, :link_expiry_days, :integer, default: 7, null: false unless column_exists?(:tenant_settings, :link_expiry_days)
    add_column :tenant_settings, :gl_lock_date, :date unless column_exists?(:tenant_settings, :gl_lock_date)
    add_column :tenant_settings, :corporate_entity_types, :jsonb unless column_exists?(:tenant_settings, :corporate_entity_types)
    add_column :tenant_settings, :job_cascade_sort, :jsonb unless column_exists?(:tenant_settings, :job_cascade_sort)
    add_column :tenant_settings, :postcode, :string unless column_exists?(:tenant_settings, :postcode)

    # Phase 2: Migrate data from corporate_company_settings (singleton table - no tenant_id)
    # Copy to tenant_id = 2 (Tekna) which is the primary tenant
    if table_exists?(:corporate_settings)
      execute <<-SQL
        UPDATE tenant_settings ts
        SET
          internal_email_domains = COALESCE(ts.internal_email_domains, ccs.internal_email_domains),
          monitored_mailbox_pay = COALESCE(ts.monitored_mailbox_pay, ccs.monitored_mailbox_pay),
          monitored_mailbox_newtask = COALESCE(ts.monitored_mailbox_newtask, ccs.monitored_mailbox_newtask),
          monitored_mailbox_newjob = COALESCE(ts.monitored_mailbox_newjob, ccs.monitored_mailbox_newjob),
          monitored_mailbox_newcase = COALESCE(ts.monitored_mailbox_newcase, ccs.monitored_mailbox_newcase),
          brand_color_primary = COALESCE(ts.brand_color_primary, ccs.brand_color_primary),
          brand_color_primary_foreground = COALESCE(ts.brand_color_primary_foreground, ccs.brand_color_primary_foreground),
          brand_color_secondary = COALESCE(ts.brand_color_secondary, ccs.brand_color_secondary),
          brand_color_muted = COALESCE(ts.brand_color_muted, ccs.brand_color_muted),
          brand_color_accent = COALESCE(ts.brand_color_accent, ccs.brand_color_accent),
          api_environment = COALESCE(ts.api_environment, ccs.api_environment, 'production'),
          link_expiry_days = COALESCE(ts.link_expiry_days, ccs.link_expiry_days, 7),
          gl_lock_date = COALESCE(ts.gl_lock_date, ccs.gl_lock_date),
          corporate_entity_types = COALESCE(ts.corporate_entity_types, ccs.corporate_entity_types),
          job_cascade_sort = COALESCE(ts.job_cascade_sort, ccs.job_cascade_sort),
          postcode = COALESCE(ts.postcode, ccs.postcode),
          company_name = COALESCE(ts.company_name, ccs.company_name),
          abn = COALESCE(ts.abn, ccs.abn),
          gst_number = COALESCE(ts.gst_number, ccs.gst_number),
          email = COALESCE(ts.email, ccs.email),
          phone = COALESCE(ts.phone, ccs.phone),
          address = COALESCE(ts.address, ccs.address),
          logo_url = COALESCE(ts.logo_url, ccs.logo_url),
          logo_mobile = COALESCE(ts.logo_mobile, ccs.logo_mobile),
          logo_dark = COALESCE(ts.logo_dark, ccs.logo_dark),
          website = COALESCE(ts.website, ccs.website),
          timezone = COALESCE(ts.timezone, ccs.timezone),
          qbcc_license = COALESCE(ts.qbcc_license, ccs.qbcc_license),
          bank_name = COALESCE(ts.bank_name, ccs.bank_name),
          bank_bsb = COALESCE(ts.bank_bsb, ccs.bank_bsb),
          bank_account_number = COALESCE(ts.bank_account_number, ccs.bank_account_number),
          bank_account_name = COALESCE(ts.bank_account_name, ccs.bank_account_name),
          twilio_account_sid = COALESCE(ts.twilio_account_sid, ccs.twilio_account_sid),
          twilio_auth_token = COALESCE(ts.twilio_auth_token, ccs.twilio_auth_token),
          twilio_phone_number = COALESCE(ts.twilio_phone_number, ccs.twilio_phone_number),
          twilio_enabled = COALESCE(ts.twilio_enabled, ccs.twilio_enabled)
        FROM corporate_company_settings ccs
        WHERE ts.tenant_id = 2;
      SQL
    end

    # Phase 3: Drop the old table
    drop_table :corporate_settings if table_exists?(:corporate_settings)
  end

  def down
    # Recreate corporate_company_settings table for rollback
    unless table_exists?(:corporate_settings)
      create_table :corporate_settings do |t|
        t.string :company_name
        t.string :abn
        t.string :gst_number
        t.string :email
        t.string :phone
        t.text :address
        t.string :logo_url
        t.string :timezone, default: "Australia/Brisbane"
        t.jsonb :working_days, default: {}
        t.timestamps
      end
    end

    # Remove the added columns
    %i[
      internal_email_domains monitored_mailbox_pay monitored_mailbox_newtask
      monitored_mailbox_newjob monitored_mailbox_newcase
      brand_color_primary brand_color_primary_foreground brand_color_secondary
      brand_color_muted brand_color_accent
      api_environment link_expiry_days gl_lock_date
      corporate_entity_types job_cascade_sort postcode
    ].each do |col|
      remove_column :tenant_settings, col if column_exists?(:tenant_settings, col)
    end
  end
end
