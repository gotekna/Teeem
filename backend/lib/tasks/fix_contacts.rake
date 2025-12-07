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
           .where.not(website: [nil, ""])
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

  desc "Fix all contact issues (name casing + website URLs)"
  task fix_all: [:fix_name_casing, :fix_website_urls]

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
