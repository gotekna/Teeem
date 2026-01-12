# frozen_string_literal: true

# SyncExclusionRule - Defines which files to skip or include in sync
#
# Rules can be:
# - System defaults (is_default: true) - Apply to everyone
# - Organization-level - Apply to all users in an org
# - User-level - Override for a specific user
#
# Rule types:
# - extension: Match file extension (e.g., ".rvt", ".dwg")
# - size: Match files over a size limit (e.g., "500MB")
# - pattern: Match filename pattern (e.g., "*.tmp", "~$*")
#
class SyncExclusionRule < ApplicationRecord
  belongs_to :organization, optional: true
  belongs_to :user, optional: true

  # Validations
  validates :rule_type, presence: true, inclusion: { in: %w[extension size pattern] }
  validates :value, presence: true
  validates :action, presence: true, inclusion: { in: %w[skip include] }
  validate :must_have_scope

  # Scopes
  scope :defaults, -> { where(is_default: true) }
  scope :for_organization, ->(org) { where(organization: org) }
  scope :for_user, ->(user) { where(user: user) }
  scope :skip_rules, -> { where(action: "skip") }
  scope :include_rules, -> { where(action: "include") }
  scope :by_priority, -> { order(priority: :desc, id: :asc) }

  # Default exclusion rules (system-wide)
  DEFAULT_RULES = [
    # Large CAD/Design files - skip by default
    { rule_type: "extension", value: ".rvt", action: "skip", description: "Revit files", priority: 10 },
    { rule_type: "extension", value: ".rfa", action: "skip", description: "Revit family files", priority: 10 },
    { rule_type: "extension", value: ".dwg", action: "skip", description: "AutoCAD files", priority: 10 },
    { rule_type: "extension", value: ".dxf", action: "skip", description: "AutoCAD exchange files", priority: 10 },
    { rule_type: "extension", value: ".skp", action: "skip", description: "SketchUp files", priority: 10 },

    # Adobe files
    { rule_type: "extension", value: ".psd", action: "skip", description: "Photoshop files", priority: 10 },
    { rule_type: "extension", value: ".ai", action: "skip", description: "Illustrator files", priority: 10 },
    { rule_type: "extension", value: ".indd", action: "skip", description: "InDesign files", priority: 10 },

    # Video files
    { rule_type: "extension", value: ".mp4", action: "skip", description: "MP4 video files", priority: 10 },
    { rule_type: "extension", value: ".mov", action: "skip", description: "MOV video files", priority: 10 },
    { rule_type: "extension", value: ".avi", action: "skip", description: "AVI video files", priority: 10 },
    { rule_type: "extension", value: ".mkv", action: "skip", description: "MKV video files", priority: 10 },

    # Temporary/system files - always skip
    { rule_type: "pattern", value: "~$*", action: "skip", description: "Office temp files", priority: 100 },
    { rule_type: "pattern", value: "*.tmp", action: "skip", description: "Temporary files", priority: 100 },
    { rule_type: "pattern", value: ".DS_Store", action: "skip", description: "macOS metadata", priority: 100 },
    { rule_type: "pattern", value: "Thumbs.db", action: "skip", description: "Windows thumbnails", priority: 100 },
    { rule_type: "pattern", value: "desktop.ini", action: "skip", description: "Windows folder settings", priority: 100 },

    # Size limit
    { rule_type: "size", value: "500MB", action: "skip", description: "Files over 500MB", priority: 5 }
  ].freeze

  # Seed default rules
  def self.seed_defaults!
    DEFAULT_RULES.each do |rule_attrs|
      find_or_create_by!(
        is_default: true,
        rule_type: rule_attrs[:rule_type],
        value: rule_attrs[:value]
      ) do |rule|
        rule.assign_attributes(rule_attrs.merge(is_default: true))
      end
    end
  end

  # Get effective rules for a user (combining defaults, org, and user rules)
  def self.effective_rules_for(organization:, user: nil)
    rules = []

    # Start with system defaults
    rules += defaults.by_priority.to_a

    # Add organization rules (can override defaults)
    if organization
      rules += for_organization(organization).by_priority.to_a
    end

    # Add user rules (can override org and defaults)
    if user
      rules += for_user(user).by_priority.to_a
    end

    # Sort by priority and deduplicate (later rules override earlier)
    rules.sort_by(&:priority).reverse
  end

  # Check if a file matches this rule
  def matches?(filename, file_size = nil)
    case rule_type
    when "extension"
      matches_extension?(filename)
    when "size"
      matches_size?(file_size)
    when "pattern"
      matches_pattern?(filename)
    else
      false
    end
  end

  # Should this file be skipped?
  def should_skip?(filename, file_size = nil)
    return false unless matches?(filename, file_size)
    action == "skip"
  end

  # Should this file be included (override)?
  def should_include?(filename, file_size = nil)
    return false unless matches?(filename, file_size)
    action == "include"
  end

  # Parse size value (e.g., "500MB" -> bytes)
  def size_in_bytes
    return nil unless rule_type == "size"

    match = value.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
    return nil unless match

    number = match[1].to_f
    unit = match[2].upcase

    case unit
    when "B" then number.to_i
    when "KB" then (number * 1024).to_i
    when "MB" then (number * 1024 * 1024).to_i
    when "GB" then (number * 1024 * 1024 * 1024).to_i
    end
  end

  # Format for API response
  def as_json(options = {})
    {
      id: id,
      rule_type: rule_type,
      value: value,
      action: action,
      description: description,
      is_default: is_default,
      priority: priority,
      scope: scope_description
    }
  end

  private

  def must_have_scope
    if !is_default && organization_id.nil? && user_id.nil?
      errors.add(:base, "Rule must be a default, org-level, or user-level rule")
    end
  end

  def matches_extension?(filename)
    return false unless rule_type == "extension"
    File.extname(filename).downcase == value.downcase
  end

  def matches_size?(file_size)
    return false unless rule_type == "size"
    return false if file_size.nil?
    file_size > size_in_bytes
  end

  def matches_pattern?(filename)
    return false unless rule_type == "pattern"

    # Convert glob pattern to regex
    pattern = value
      .gsub(".", "\\.")
      .gsub("*", ".*")
      .gsub("?", ".")

    filename.match?(/^#{pattern}$/i)
  end

  def scope_description
    if is_default
      "System default"
    elsif user_id
      "User override"
    elsif organization_id
      "Organization"
    else
      "Unknown"
    end
  end
end
