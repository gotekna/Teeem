# frozen_string_literal: true

namespace :contacts do
  desc "Fix all contacts with name casing issues (ALL CAPS or lowercase)"
  task fix_name_casing: :environment do
    puts "Fixing contact name casing issues..."
    puts

    fixed_count = 0
    error_count = 0

    # Find persons with ALL CAPS or lowercase names
    # Use unscoped to include soft-deleted contacts too
    # Skip single-letter names (initials are fine as uppercase)
    Contact.unscoped.where(entity_type: "person").find_each do |contact|
      changes = {}

      # Check first_name (skip single letters)
      if contact.first_name.present? && contact.first_name.length > 1
        if all_caps?(contact.first_name) || all_lowercase?(contact.first_name)
          changes[:first_name] = titleize_name(contact.first_name)
        end
      end

      # Check middle_name (skip single letters)
      if contact.middle_name.present? && contact.middle_name.length > 1
        if all_caps?(contact.middle_name) || all_lowercase?(contact.middle_name)
          changes[:middle_name] = titleize_name(contact.middle_name)
        end
      end

      # Check last_name (skip single letters)
      if contact.last_name.present? && contact.last_name.length > 1
        if all_caps?(contact.last_name) || all_lowercase?(contact.last_name)
          changes[:last_name] = titleize_name(contact.last_name)
        end
      end

      if changes.any?
        begin
          # Use update_columns to skip callbacks and validations for speed
          contact.update_columns(changes)
          fixed_count += 1
          puts "Fixed: #{contact.id} - #{changes.inspect}"
        rescue => e
          error_count += 1
          puts "Error fixing #{contact.id}: #{e.message}"
        end
      end
    end

    puts
    puts "Done! Fixed #{fixed_count} contacts, #{error_count} errors."
  end

  desc "Fix all contacts with invalid website URLs (missing http/https)"
  task fix_website_urls: :environment do
    puts "Fixing contact website URLs..."
    puts

    fixed_count = 0
    error_count = 0

    # Find contacts with website that doesn't start with http:// or https://
    Contact.unscoped
           .where.not(website: [ nil, "" ])
           .where.not("website LIKE 'http://%' OR website LIKE 'https://%'")
           .find_each do |contact|
      begin
        new_url = "https://#{contact.website}"
        contact.update_columns(website: new_url)
        fixed_count += 1
        puts "Fixed: #{contact.id} - #{contact.website} -> #{new_url}"
      rescue => e
        error_count += 1
        puts "Error fixing #{contact.id}: #{e.message}"
      end
    end

    puts
    puts "Done! Fixed #{fixed_count} contacts, #{error_count} errors."
  end

  desc "Fix all contact issues (name casing + website URLs + company enrichment + full_name + clear person fields + orphaned relationships)"
  task fix_all: [ :fix_name_casing, :fix_website_urls, :enrich_company_websites, :fix_full_names, :clear_person_fields_from_non_persons, :fix_orphaned_relationships ]

  desc "Delete orphaned contact relationships (pointing to deleted/non-existent contacts)"
  task fix_orphaned_relationships: :environment do
    puts "Finding orphaned contact relationships..."
    puts

    # Get all contact IDs (including soft-deleted)
    all_contact_ids = Contact.unscoped.pluck(:id)

    # Find orphaned relationships
    orphaned = ContactRelationship
                 .where.not(related_contact_id: all_contact_ids)
                 .or(ContactRelationship.where.not(source_contact_id: all_contact_ids))

    count = orphaned.count
    puts "Found #{count} orphaned relationships"

    orphaned.find_each do |rel|
      puts "  Deleting: #{rel.id} - #{rel.source_contact_id} -> #{rel.relationship_type} -> #{rel.related_contact_id}"
      rel.destroy
    end

    puts
    puts "Done! Deleted #{count} orphaned relationships."
  end

  desc "Fix full_name field based on entity type rules"
  task fix_full_names: :environment do
    puts "Fixing contact full_name fields..."
    puts

    fixed_count = 0
    error_count = 0

    Contact.unscoped.find_each do |contact|
      begin
        # Calculate the correct full_name based on entity type
        correct_full_name = case contact.entity_type
        when "person", "sole_trader"
          # Person: first_name + middle_name + last_name
          [ contact.first_name, contact.middle_name, contact.last_name ].compact.reject(&:blank?).join(" ")
        when "company", "trust"
          # Company/Trust: use company_name_or_trust
          contact.company_name_or_trust.presence || contact.full_name
        else
          # Unknown type: try to build from parts or keep existing
          parts = [ contact.first_name, contact.middle_name, contact.last_name ].compact.reject(&:blank?)
          parts.any? ? parts.join(" ") : (contact.company_name_or_trust.presence || contact.full_name)
        end

        # Skip if full_name is already correct or we couldn't determine a name
        next if correct_full_name.blank?
        next if contact.full_name == correct_full_name

        # Update the full_name
        old_name = contact.full_name
        contact.update_columns(full_name: correct_full_name)
        fixed_count += 1
        puts "Fixed: #{contact.id} - '#{old_name}' -> '#{correct_full_name}' (#{contact.entity_type})"
      rescue => e
        error_count += 1
        puts "Error fixing #{contact.id}: #{e.message}"
      end
    end

    puts
    puts "Done! Fixed #{fixed_count} contacts, #{error_count} errors."
  end

  desc "Clear first_name, middle_name, last_name from company/trust/price_only contacts"
  task clear_person_fields_from_non_persons: :environment do
    puts "Clearing person name fields from company/trust/price_only contacts..."
    puts

    fixed_count = 0
    error_count = 0

    # Find company, trust, and price_only contacts that have first_name, middle_name, or last_name set
    Contact.unscoped
           .where(entity_type: [ "company", "trust", "price_only" ])
           .where("first_name IS NOT NULL AND first_name != '' OR middle_name IS NOT NULL AND middle_name != '' OR last_name IS NOT NULL AND last_name != ''")
           .find_each do |contact|
      begin
        changes = {}
        old_values = []

        if contact.first_name.present?
          old_values << "first_name: '#{contact.first_name}'"
          changes[:first_name] = nil
        end

        if contact.middle_name.present?
          old_values << "middle_name: '#{contact.middle_name}'"
          changes[:middle_name] = nil
        end

        if contact.last_name.present?
          old_values << "last_name: '#{contact.last_name}'"
          changes[:last_name] = nil
        end

        if changes.any?
          contact.update_columns(changes)
          fixed_count += 1
          puts "Cleared: #{contact.id} - #{contact.full_name} (#{contact.entity_type}) - #{old_values.join(', ')}"
        end
      rescue => e
        error_count += 1
        puts "Error clearing #{contact.id}: #{e.message}"
      end
    end

    puts
    puts "Done! Cleared person fields from #{fixed_count} contacts, #{error_count} errors."
  end

  desc "Auto-enrich company contacts with obvious website URLs"
  task enrich_company_websites: :environment do
    puts "Enriching company contacts with website URLs..."
    puts

    # Well-known Australian companies and their websites
    known_companies = {
      "harvey norman" => "https://www.harveynorman.com.au",
      "bunnings" => "https://www.bunnings.com.au",
      "woolworths" => "https://www.woolworths.com.au",
      "coles" => "https://www.coles.com.au",
      "kmart" => "https://www.kmart.com.au",
      "target" => "https://www.target.com.au",
      "big w" => "https://www.bigw.com.au",
      "officeworks" => "https://www.officeworks.com.au",
      "jb hi-fi" => "https://www.jbhifi.com.au",
      "jb hifi" => "https://www.jbhifi.com.au",
      "aldi" => "https://www.aldi.com.au",
      "ikea" => "https://www.ikea.com/au",
      "costco" => "https://www.costco.com.au",
      "telstra" => "https://www.telstra.com.au",
      "optus" => "https://www.optus.com.au",
      "vodafone" => "https://www.vodafone.com.au",
      "qantas" => "https://www.qantas.com",
      "virgin australia" => "https://www.virginaustralia.com",
      "jetstar" => "https://www.jetstar.com",
      "commonwealth bank" => "https://www.commbank.com.au",
      "commbank" => "https://www.commbank.com.au",
      "westpac" => "https://www.westpac.com.au",
      "anz" => "https://www.anz.com.au",
      "nab" => "https://www.nab.com.au",
      "national australia bank" => "https://www.nab.com.au",
      "reece" => "https://www.reece.com.au",
      "tradelink" => "https://www.tradelink.com.au",
      "beaumont tiles" => "https://www.beaumont-tiles.com.au",
      "mitre 10" => "https://www.mitre10.com.au",
      "stratco" => "https://www.stratco.com.au",
      "total tools" => "https://www.totaltools.com.au",
      "supercheap auto" => "https://www.supercheapauto.com.au",
      "autobarn" => "https://www.autobarn.com.au",
      "repco" => "https://www.repco.com.au",
      "the good guys" => "https://www.thegoodguys.com.au",
      "good guys" => "https://www.thegoodguys.com.au",
      "spotlight" => "https://www.spotlight.com.au",
      "anaconda" => "https://www.anacondastores.com.au",
      "rebel" => "https://www.rebelsport.com.au",
      "amart" => "https://www.amartfurniture.com.au",
      "fantastic furniture" => "https://www.fantasticfurniture.com.au",
      "freedom" => "https://www.freedom.com.au",
      "nick scali" => "https://www.nickscali.com.au",
      "plumbing world" => "https://www.plumbingworld.co.nz",
      "beacon lighting" => "https://www.beaconlighting.com.au",
      "carpet court" => "https://www.carpetcourt.com.au",
      "flooring xtra" => "https://www.flooringxtra.com.au",
      "lincoln sentry" => "https://www.lincolnsentry.com.au",
      "masters home improvement" => "https://www.masters.com.au",
      "home timber & hardware" => "https://www.homehardware.com.au",
      "home hardware" => "https://www.homehardware.com.au"
    }

    enriched_count = 0
    error_count = 0

    # Find company/trust contacts without website
    Contact.unscoped
           .where(entity_type: [ "company", "trust" ])
           .where("website IS NULL OR website = ''")
           .find_each do |contact|
      company_name = (contact.company_name_or_trust.presence || contact.full_name).to_s.downcase.strip
      # Clean the company name - remove suffixes like Pty Ltd, etc.
      clean_name = company_name.gsub(/\s*(pty\.?\s*ltd\.?|ltd\.?|limited|inc\.?|incorporated|llc|plc|group|holdings?|australia|aust?\.?)\s*$/i, "").strip

      # Check against known companies - must be a strong match
      known_companies.each do |known_name, url|
        # Strong match: clean name starts with known name, or known name equals clean name
        is_match = clean_name == known_name ||
                   clean_name.start_with?("#{known_name} ") ||
                   clean_name.end_with?(" #{known_name}") ||
                   clean_name == "the #{known_name}" ||
                   clean_name.start_with?("#{known_name} -")

        if is_match
          begin
            contact.update_columns(website: url)
            enriched_count += 1
            puts "Enriched: #{contact.id} - #{contact.full_name} -> #{url}"
          rescue => e
            error_count += 1
            puts "Error enriching #{contact.id}: #{e.message}"
          end
          break
        end
      end
    end

    puts
    puts "Done! Enriched #{enriched_count} companies, #{error_count} errors."
  end

  private

  def all_caps?(str)
    return false if str.blank?
    str == str.upcase && str != str.downcase
  end

  def all_lowercase?(str)
    return false if str.blank?
    str == str.downcase && str =~ /[a-z]/
  end

  def titleize_name(name)
    return name if name.blank?

    name.split(/\s+/).map do |word|
      if word.include?("'")
        word.split("'").map(&:capitalize).join("'")
      else
        word.capitalize
      end
    end.join(" ")
  end
end
