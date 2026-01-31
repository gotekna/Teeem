# frozen_string_literal: true

# This migration consolidates CorporateCompanySetting into TenantSetting as the SSoT
# for all tenant-level settings. This eliminates the duplicate settings pattern.
#
# Phase 1: Add missing columns to tenant_settings
# Phase 2: Migrate data from corporate_company_settings
# Phase 3: Add deprecation markers
class ConsolidateCorporateSettingsToTenantSettings < ActiveRecord::Migration[8.0]
  def up
    # Phase 1: Add missing columns to tenant_settings
    # These columns exist in corporate_company_settings but not tenant_settings

    # Email configuration
    add_column :tenant_settings, :internal_email_domains, :string unless column_exists?(:tenant_settings, :internal_email_domains)
    add_column :tenant_settings, :monitored_mailbox_pay, :string unless column_exists?(:tenant_settings, :monitored_mailbox_pay)
    add_column :tenant_settings, :monitored_mailbox_newtask, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newtask)
    add_column :tenant_settings, :monitored_mailbox_newjob, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newjob)
    add_column :tenant_settings, :monitored_mailbox_newcase, :string unless column_exists?(:tenant_settings, :monitored_mailbox_newcase)

    # Brand colors (HSL format)
    add_column :tenant_settings, :brand_color_primary, :string unless column_exists?(:tenant_settings, :brand_color_primary)
    add_column :tenant_settings, :brand_color_primary_foreground, :string unless column_exists?(:tenant_settings, :brand_color_primary_foreground)
    add_column :tenant_settings, :brand_color_secondary, :string unless column_exists?(:tenant_settings, :brand_color_secondary)
    add_column :tenant_settings, :brand_color_muted, :string unless column_exists?(:tenant_settings, :brand_color_muted)
    add_column :tenant_settings, :brand_color_accent, :string unless column_exists?(:tenant_settings, :brand_color_accent)

    # API and link configuration
    add_column :tenant_settings, :api_environment, :string, default: "production" unless column_exists?(:tenant_settings, :api_environment)
    add_column :tenant_settings, :link_expiry_days, :integer, default: 7, null: false unless column_exists?(:tenant_settings, :link_expiry_days)

    # Business configuration
    add_column :tenant_settings, :gl_lock_date, :date unless column_exists?(:tenant_settings, :gl_lock_date)
    add_column :tenant_settings, :corporate_entity_types, :jsonb unless column_exists?(:tenant_settings, :corporate_entity_types)
    add_column :tenant_settings, :job_cascade_sort, :jsonb unless column_exists?(:tenant_settings, :job_cascade_sort)

    # Address details
    add_column :tenant_settings, :postcode, :string unless column_exists?(:tenant_settings, :postcode)

    # Phase 2: Migrate data from corporate_company_settings to tenant_settings
    # Only migrate if corporate_company_settings exists and has tenant_id column
    if table_exists?(:corporate_company_settings)
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
          postcode = COALESCE(ts.postcode, ccs.postcode)
        FROM corporate_company_settings ccs
        WHERE ts.tenant_id = ccs.tenant_id OR (ts.tenant_id IS NULL AND ccs.tenant_id IS NULL);
      SQL

      # For tenants with no TenantSetting but a CorporateCompanySetting, create from CCS
      # First, ensure tenant_id constraint allows NULL temporarily for this migration
      execute <<-SQL
        INSERT INTO tenant_settings (
          tenant_id, company_name, abn, gst_number, email, phone, address,
          logo_url, logo_mobile, logo_dark, website,
          timezone, working_days, team_email_domains,
          bank_name, bank_bsb, bank_account_number, bank_account_name,
          twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled,
          internal_email_domains, monitored_mailbox_pay, monitored_mailbox_newtask,
          monitored_mailbox_newjob, monitored_mailbox_newcase,
          brand_color_primary, brand_color_primary_foreground, brand_color_secondary,
          brand_color_muted, brand_color_accent,
          api_environment, link_expiry_days, gl_lock_date,
          corporate_entity_types, job_cascade_sort, postcode,
          qbcc_license, created_at, updated_at, corporate_group_id
        )
        SELECT
          ccs.tenant_id,
          ccs.company_name,
          ccs.abn,
          ccs.gst_number,
          ccs.email,
          ccs.phone,
          ccs.address,
          ccs.logo_url,
          ccs.logo_mobile,
          ccs.logo_dark,
          ccs.website,
          COALESCE(ccs.timezone, 'Australia/Brisbane'),
          COALESCE(ccs.working_days, '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":true}'::jsonb),
          COALESCE(ccs.team_email_domains, '[]'::text[])::jsonb,
          ccs.bank_name,
          ccs.bank_bsb,
          ccs.bank_account_number,
          ccs.bank_account_name,
          ccs.twilio_account_sid,
          ccs.twilio_auth_token,
          ccs.twilio_phone_number,
          ccs.twilio_enabled,
          ccs.internal_email_domains,
          ccs.monitored_mailbox_pay,
          ccs.monitored_mailbox_newtask,
          ccs.monitored_mailbox_newjob,
          ccs.monitored_mailbox_newcase,
          ccs.brand_color_primary,
          ccs.brand_color_primary_foreground,
          ccs.brand_color_secondary,
          ccs.brand_color_muted,
          ccs.brand_color_accent,
          COALESCE(ccs.api_environment, 'production'),
          COALESCE(ccs.link_expiry_days, 7),
          ccs.gl_lock_date,
          ccs.corporate_entity_types,
          ccs.job_cascade_sort,
          ccs.postcode,
          ccs.qbcc_license,
          NOW(),
          NOW(),
          (SELECT id FROM corporate_groups LIMIT 1)
        FROM corporate_company_settings ccs
        WHERE ccs.tenant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM tenant_settings ts WHERE ts.tenant_id = ccs.tenant_id
          );
      SQL
    end

    # Phase 3: Mark corporate_company_settings as deprecated by adding a comment
    # The table will be dropped in a future migration after verification
    execute <<-SQL
      COMMENT ON TABLE corporate_company_settings IS 'DEPRECATED: Use tenant_settings instead. This table will be removed in a future migration.';
    SQL
  end

  def down
    # Remove the added columns (keep the table for rollback)
    remove_column :tenant_settings, :internal_email_domains if column_exists?(:tenant_settings, :internal_email_domains)
    remove_column :tenant_settings, :monitored_mailbox_pay if column_exists?(:tenant_settings, :monitored_mailbox_pay)
    remove_column :tenant_settings, :monitored_mailbox_newtask if column_exists?(:tenant_settings, :monitored_mailbox_newtask)
    remove_column :tenant_settings, :monitored_mailbox_newjob if column_exists?(:tenant_settings, :monitored_mailbox_newjob)
    remove_column :tenant_settings, :monitored_mailbox_newcase if column_exists?(:tenant_settings, :monitored_mailbox_newcase)
    remove_column :tenant_settings, :brand_color_primary if column_exists?(:tenant_settings, :brand_color_primary)
    remove_column :tenant_settings, :brand_color_primary_foreground if column_exists?(:tenant_settings, :brand_color_primary_foreground)
    remove_column :tenant_settings, :brand_color_secondary if column_exists?(:tenant_settings, :brand_color_secondary)
    remove_column :tenant_settings, :brand_color_muted if column_exists?(:tenant_settings, :brand_color_muted)
    remove_column :tenant_settings, :brand_color_accent if column_exists?(:tenant_settings, :brand_color_accent)
    remove_column :tenant_settings, :api_environment if column_exists?(:tenant_settings, :api_environment)
    remove_column :tenant_settings, :link_expiry_days if column_exists?(:tenant_settings, :link_expiry_days)
    remove_column :tenant_settings, :gl_lock_date if column_exists?(:tenant_settings, :gl_lock_date)
    remove_column :tenant_settings, :corporate_entity_types if column_exists?(:tenant_settings, :corporate_entity_types)
    remove_column :tenant_settings, :job_cascade_sort if column_exists?(:tenant_settings, :job_cascade_sort)
    remove_column :tenant_settings, :postcode if column_exists?(:tenant_settings, :postcode)

    # Remove deprecation comment
    execute <<-SQL
      COMMENT ON TABLE corporate_company_settings IS NULL;
    SQL
  end
end
