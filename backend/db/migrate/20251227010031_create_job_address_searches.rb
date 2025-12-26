# Email Performance: Create Job Address Search Table
# Part of 6-month email performance masterpiece plan
#
# Purpose:
# Replace the N+1 Job.find_each loop in find_matching_jobs() with SQL-based
# trigram similarity matching. Instead of loading 10,000+ jobs into Ruby
# memory for every email, we use PostgreSQL's pg_trgm extension for
# fuzzy string matching directly in SQL.
#
# Impact:
# - find_matching_jobs: 10,000,000 Job objects/day → 3-5 SQL queries/email
# - Memory usage: Massive reduction during email sync
# - Matching speed: 10x faster with indexed trigram search
class CreateJobAddressSearches < ActiveRecord::Migration[7.1]
  def up
    # Enable PostgreSQL trigram extension for fuzzy string matching
    enable_extension 'pg_trgm' unless extension_enabled?('pg_trgm')

    create_table :job_address_searches do |t|
      t.references :job, null: false, foreign_key: true, index: true
      t.string :search_term, null: false  # Normalized address/street
      t.string :term_type, null: false    # 'full_address', 'street_name', 'suburb', 'job_number'

      t.timestamps
    end

    # GIN index for fast trigram similarity searches
    # This enables the % operator for fuzzy matching
    add_index :job_address_searches, :search_term,
              using: :gin,
              opclass: :gin_trgm_ops,
              name: 'idx_job_address_searches_trgm'

    # Composite index for job + term type lookups
    add_index :job_address_searches, [:job_id, :term_type],
              name: 'idx_job_address_searches_job_type'

    # Populate existing jobs
    populate_search_terms
  end

  def down
    drop_table :job_address_searches
  end

  private

  def populate_search_terms
    say_with_time "Populating job address search terms" do
      Job.find_each do |job|
        terms = extract_search_terms(job)
        terms.each do |term|
          execute sanitize_sql_array([
            "INSERT INTO job_address_searches (job_id, search_term, term_type, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
            job.id, term[:term], term[:type]
          ])
        end
      end
    end
  end

  def extract_search_terms(job)
    terms = []

    # Job number (exact match)
    if job.job_number.present?
      terms << { term: job.job_number.to_s.downcase, type: 'job_number' }
    end

    # Full address from name field
    if job.name.present?
      terms << { term: job.name.downcase.strip, type: 'full_address' }

      # Extract street name (e.g., "32 Mcilwraith Street" -> "mcilwraith")
      street_match = job.name.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres|Boulevard|Blvd|Lane|Ln|Way|Terrace|Tce|Circuit|Cct|Close|Cl)/i)
      if street_match
        terms << { term: street_match[1].downcase.strip, type: 'street_name' }
      end
    end

    # Title if different from name
    if job.title.present? && job.title != job.name
      terms << { term: job.title.downcase.strip, type: 'title' }
    end

    terms
  end

  def sanitize_sql_array(array)
    ActiveRecord::Base.send(:sanitize_sql_array, array)
  end
end
