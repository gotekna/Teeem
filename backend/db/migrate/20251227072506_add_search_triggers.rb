# frozen_string_literal: true

# Gold Standard Search Infrastructure - Phase 2: Triggers
#
# Creates PostgreSQL triggers to auto-update tsvector columns on insert/update.
# This is more efficient than Rails callbacks for large tables.
#
# Each table gets:
# 1. A custom trigger function that builds the tsvector from specific columns
# 2. A BEFORE INSERT OR UPDATE trigger that calls the function
#
class AddSearchTriggers < ActiveRecord::Migration[7.1]
  def up
    # Helper to create trigger + function for a table
    # Note: email_warehouse already has a Rails callback, so we skip it
    # for now and let it continue using the callback

    # 1. corporate_company_documents
    # Columns: file_name, display_name, description, folder
    execute <<-SQL
      CREATE OR REPLACE FUNCTION corporate_company_documents_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            coalesce(NEW.file_name, '') || ' ' ||
            coalesce(NEW.display_name, '') || ' ' ||
            coalesce(NEW.description, '') || ' ' ||
            coalesce(NEW.folder, ''),
            '[^a-zA-Z0-9\\s]', ' ', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_documents_searchable ON corporate_company_documents;
      CREATE TRIGGER update_documents_searchable
      BEFORE INSERT OR UPDATE ON corporate_company_documents
      FOR EACH ROW EXECUTE FUNCTION corporate_company_documents_searchable_trigger();
    SQL

    # 2. jobs
    # Columns: name, location, suburb, street_name
    execute <<-SQL
      CREATE OR REPLACE FUNCTION jobs_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            coalesce(NEW.name, '') || ' ' ||
            coalesce(NEW.location, '') || ' ' ||
            coalesce(NEW.suburb, '') || ' ' ||
            coalesce(NEW.street_name, ''),
            '[^a-zA-Z0-9\\s]', ' ', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_jobs_searchable ON jobs;
      CREATE TRIGGER update_jobs_searchable
      BEFORE INSERT OR UPDATE ON jobs
      FOR EACH ROW EXECUTE FUNCTION jobs_searchable_trigger();
    SQL

    # 3. contacts (includes suppliers)
    # Columns: first_name, last_name, email, company_name, display_name, phone
    execute <<-SQL
      CREATE OR REPLACE FUNCTION contacts_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            coalesce(NEW.first_name, '') || ' ' ||
            coalesce(NEW.last_name, '') || ' ' ||
            coalesce(NEW.email, '') || ' ' ||
            coalesce(NEW.company_name, '') || ' ' ||
            coalesce(NEW.display_name, '') || ' ' ||
            coalesce(NEW.phone, ''),
            '[^a-zA-Z0-9\\s@.]', ' ', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_contacts_searchable ON contacts;
      CREATE TRIGGER update_contacts_searchable
      BEFORE INSERT OR UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION contacts_searchable_trigger();
    SQL

    # 4. sm_tasks
    # Columns: name, description
    execute <<-SQL
      CREATE OR REPLACE FUNCTION sm_tasks_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            coalesce(NEW.name, '') || ' ' ||
            coalesce(NEW.description, ''),
            '[^a-zA-Z0-9\\s]', ' ', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_sm_tasks_searchable ON sm_tasks;
      CREATE TRIGGER update_sm_tasks_searchable
      BEFORE INSERT OR UPDATE ON sm_tasks
      FOR EACH ROW EXECUTE FUNCTION sm_tasks_searchable_trigger();
    SQL

    # 5. purchase_orders
    # Columns: po_number, description, notes
    execute <<-SQL
      CREATE OR REPLACE FUNCTION purchase_orders_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            coalesce(NEW.po_number, '') || ' ' ||
            coalesce(NEW.description, '') || ' ' ||
            coalesce(NEW.notes, ''),
            '[^a-zA-Z0-9\\s]', ' ', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_purchase_orders_searchable ON purchase_orders;
      CREATE TRIGGER update_purchase_orders_searchable
      BEFORE INSERT OR UPDATE ON purchase_orders
      FOR EACH ROW EXECUTE FUNCTION purchase_orders_searchable_trigger();
    SQL
  end

  def down
    # Drop triggers and functions
    execute <<-SQL
      DROP TRIGGER IF EXISTS update_documents_searchable ON corporate_company_documents;
      DROP FUNCTION IF EXISTS corporate_company_documents_searchable_trigger();

      DROP TRIGGER IF EXISTS update_jobs_searchable ON jobs;
      DROP FUNCTION IF EXISTS jobs_searchable_trigger();

      DROP TRIGGER IF EXISTS update_contacts_searchable ON contacts;
      DROP FUNCTION IF EXISTS contacts_searchable_trigger();

      DROP TRIGGER IF EXISTS update_sm_tasks_searchable ON sm_tasks;
      DROP FUNCTION IF EXISTS sm_tasks_searchable_trigger();

      DROP TRIGGER IF EXISTS update_purchase_orders_searchable ON purchase_orders;
      DROP FUNCTION IF EXISTS purchase_orders_searchable_trigger();
    SQL
  end
end
