# frozen_string_literal: true

# Self-healing concern for automatic data quality fixes
# Include in models that should auto-fix formatting issues on save
#
# When a record is saved, this concern will:
# 1. Detect formatting issues (ALL CAPS names, missing https://, etc.)
# 2. Auto-fix them before save
# 3. Award kudos points to the System
#
# The System earns kudos for auto-fixes, creating a competition with humans
# who earn kudos for manual fixes.
#
# Usage:
#   class Contact < ApplicationRecord
#     include SelfHealing
#   end
#
module SelfHealing
  extend ActiveSupport::Concern

  # Points awarded per fix type (System earns these)
  SELF_HEALING_POINTS = {
    name_casing: 5,
    website_prefix: 3,
    phone_format: 2,
    email_lowercase: 1,
    abn_format: 2,
    acn_format: 2
  }.freeze

  included do
    before_save :auto_fix_formatting
    after_save :award_system_kudos_if_fixed, if: -> { @self_healing_fixes_applied.present? }
  end

  private

  def auto_fix_formatting
    @self_healing_fixes_applied = []
    @self_healing_original_values = {}

    # Name casing fixes
    fix_name_casing if respond_to?(:first_name) || respond_to?(:name)

    # Website prefix fix
    fix_website_prefix if respond_to?(:website)

    # Phone formatting
    fix_phone_format if respond_to?(:phone) || respond_to?(:mobile) || respond_to?(:mobile_phone)

    # Email lowercase
    fix_email_lowercase if respond_to?(:email)

    # ABN/ACN formatting
    fix_abn_format if respond_to?(:abn)
    fix_acn_format if respond_to?(:acn)
  end

  def fix_name_casing
    # Fix first_name
    if respond_to?(:first_name) && first_name.present?
      original = first_name
      if needs_casing_fix?(first_name)
        self.first_name = titleize_name(first_name)
        if first_name != original
          @self_healing_original_values[:first_name] = original
          @self_healing_fixes_applied << :name_casing
        end
      end
    end

    # Fix last_name
    if respond_to?(:last_name) && last_name.present?
      original = last_name
      if needs_casing_fix?(last_name)
        self.last_name = titleize_name(last_name)
        if last_name != original
          @self_healing_original_values[:last_name] = original
          @self_healing_fixes_applied << :name_casing unless @self_healing_fixes_applied.include?(:name_casing)
        end
      end
    end

    # Fix generic name field
    if respond_to?(:name) && !respond_to?(:first_name) && name.present?
      original = name
      if needs_casing_fix?(name)
        self.name = titleize_name(name)
        if name != original
          @self_healing_original_values[:name] = original
          @self_healing_fixes_applied << :name_casing
        end
      end
    end
  end

  def fix_website_prefix
    return unless website.present?
    return if website.start_with?("http://", "https://")

    original = website
    self.website = "https://#{website}"
    @self_healing_original_values[:website] = original
    @self_healing_fixes_applied << :website_prefix
  end

  def fix_phone_format
    # Fix phone (only if setter exists - some models have phone as read-only alias)
    if respond_to?(:phone=) && respond_to?(:phone) && phone.present?
      formatted = format_australian_phone(phone)
      if formatted != phone
        @self_healing_original_values[:phone] = phone
        self.phone = formatted
        @self_healing_fixes_applied << :phone_format
      end
    end

    # Fix mobile (only if setter exists - some models have mobile as read-only alias)
    if respond_to?(:mobile=) && respond_to?(:mobile) && mobile.present?
      formatted = format_australian_phone(mobile)
      if formatted != mobile
        @self_healing_original_values[:mobile] = mobile
        self.mobile = formatted
        @self_healing_fixes_applied << :phone_format unless @self_healing_fixes_applied.include?(:phone_format)
      end
    end

    # Fix mobile_phone (Contact model - actual column, always has setter)
    if respond_to?(:mobile_phone) && mobile_phone.present?
      formatted = format_australian_phone(mobile_phone)
      if formatted != mobile_phone
        @self_healing_original_values[:mobile_phone] = mobile_phone
        self.mobile_phone = formatted
        @self_healing_fixes_applied << :phone_format unless @self_healing_fixes_applied.include?(:phone_format)
      end
    end
  end

  def fix_email_lowercase
    return unless email.present?
    return if email == email.downcase

    original = email
    self.email = email.downcase
    @self_healing_original_values[:email] = original
    @self_healing_fixes_applied << :email_lowercase
  end

  def fix_abn_format
    return unless abn.present?

    # Remove non-digits first
    digits_only = abn.gsub(/\D/, "")
    return unless digits_only.length == 11

    # Format as XX XXX XXX XXX
    formatted = "#{digits_only[0..1]} #{digits_only[2..4]} #{digits_only[5..7]} #{digits_only[8..10]}"

    if formatted != abn
      @self_healing_original_values[:abn] = abn
      self.abn = formatted
      @self_healing_fixes_applied << :abn_format
    end
  end

  def fix_acn_format
    return unless acn.present?

    # Remove non-digits first
    digits_only = acn.gsub(/\D/, "")
    return unless digits_only.length == 9

    # Format as XXX XXX XXX
    formatted = "#{digits_only[0..2]} #{digits_only[3..5]} #{digits_only[6..8]}"

    if formatted != acn
      @self_healing_original_values[:acn] = acn
      self.acn = formatted
      @self_healing_fixes_applied << :acn_format
    end
  end

  def needs_casing_fix?(text)
    return false if text.blank?
    # Check if ALL CAPS or all lowercase
    text == text.upcase || text == text.downcase
  end

  def titleize_name(text)
    return text if text.blank?

    # Handle special cases like McDonald, O'Brien, etc.
    text.split(/(\s|-)/).map do |part|
      next part if part =~ /^\s|-$/

      # Handle Mc/Mac prefixes
      if part =~ /^(mc|mac)/i
        prefix = part[0..1]
        rest = part[2..]
        "#{prefix.capitalize}#{rest&.capitalize}"
      # Handle O' prefixes
      elsif part =~ /^o'/i
        "O'#{part[2..]&.capitalize}"
      else
        part.capitalize
      end
    end.join
  end

  def format_australian_phone(phone)
    return phone if phone.blank?

    # Remove all non-digit characters
    digits = phone.gsub(/\D/, "")

    # Handle Australian mobile numbers (04XX XXX XXX)
    if digits.length == 10 && digits.start_with?("04")
      return "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    end

    # Handle Australian landlines with area code (XX XXXX XXXX)
    if digits.length == 10 && digits.start_with?("0")
      return "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
    end

    # Handle international format starting with 61 (Australia)
    if digits.length == 11 && digits.start_with?("61")
      local = digits[2..]
      if local.start_with?("4")
        return "+61 #{local[0..2]} #{local[3..5]} #{local[6..8]}"
      else
        return "+61 #{local[0]} #{local[1..4]} #{local[5..8]}"
      end
    end

    # Return original if we can't format it
    phone
  end

  def award_system_kudos_if_fixed
    return if @self_healing_fixes_applied.blank?

    # Dedupe fix types
    fix_types = @self_healing_fixes_applied.uniq

    fix_types.each do |fix_type|
      points = SELF_HEALING_POINTS[fix_type] || 1

      # DISABLED: Health gamification temporarily disabled
      # HealthKudosEvent.record_system_fix(
      #   fix_type: fix_type,
      #   record: self,
      #   points: points,
      #   details: {
      #     original_values: @self_healing_original_values,
      #     model: self.class.name
      #   },
      #   description: "Auto-fixed #{fix_type.to_s.humanize.downcase} in #{self.class.name}"
      # )
    end

    # Clear the tracking arrays
    @self_healing_fixes_applied = nil
    @self_healing_original_values = nil
  rescue StandardError => e
    # Don't let kudos tracking errors break saves
    Rails.logger.error "[SelfHealing] Error awarding kudos: #{e.message}"
  end
end
