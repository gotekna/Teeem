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
  validates :rule_type, presence: true, inclusion: { in: %w[extension size pattern category folder_scope] }
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

  # Folder scopes for opt-in sync (Office 365/SharePoint folders)
  # Users choose which folder scopes to sync (none by default)
  FOLDER_SCOPES = {
    jobs: {
      name: "Jobs",
      description: "Job folders and documents",
      icon: "briefcase",
      warehouse_type: "job"
    },
    corporate: {
      name: "Corporate",
      description: "Company and entity documents",
      icon: "building",
      warehouse_type: "corporate_entity"
    },
    contacts: {
      name: "Contacts",
      description: "Contact and people documents",
      icon: "users",
      warehouse_type: "contact"
    },
    emails: {
      name: "Emails",
      description: "Email archives and attachments",
      icon: "mail",
      warehouse_type: "email"
    },
    tasks: {
      name: "Tasks",
      description: "Task attachments and responses",
      icon: "clipboard",
      warehouse_type: "task"
    },
    warehouse: {
      name: "Warehouse",
      description: "General file warehouse",
      icon: "warehouse",
      warehouse_type: "warehouse"
    },
    user: {
      name: "Teeem Docs",
      description: "Personal user documents",
      icon: "folder-heart",
      warehouse_type: "user"
    }
  }.freeze

  # File type categories for opt-in sync
  # Users choose which categories to sync (none by default)
  FILE_CATEGORIES = {
    documents: {
      name: "Documents",
      description: "PDF, Word, Excel, PowerPoint",
      extensions: %w[.pdf .doc .docx .xls .xlsx .ppt .pptx .txt .rtf .odt .ods .odp]
    },
    images: {
      name: "Images",
      description: "Photos and graphics",
      extensions: %w[.jpg .jpeg .png .gif .bmp .tiff .webp .svg]
    },
    cad: {
      name: "CAD & Design",
      description: "AutoCAD, Revit, SketchUp",
      extensions: %w[.dwg .dxf .rvt .rfa .skp .3ds .obj .fbx]
    },
    adobe: {
      name: "Adobe Creative",
      description: "Photoshop, Illustrator, InDesign",
      extensions: %w[.psd .ai .indd .eps .xd]
    },
    video: {
      name: "Video",
      description: "Video files (large)",
      extensions: %w[.mp4 .mov .avi .mkv .wmv .flv .webm]
    },
    audio: {
      name: "Audio",
      description: "Music and sound files",
      extensions: %w[.mp3 .wav .aac .flac .ogg .m4a]
    },
    archives: {
      name: "Archives",
      description: "Compressed files",
      extensions: %w[.zip .rar .7z .tar .gz]
    },
    emails: {
      name: "Emails",
      description: "Email files",
      extensions: %w[.eml .msg]
    }
  }.freeze

  # Default exclusion rules (system-wide)
  # OPT-IN MODEL: Skip all by default, users enable categories they want
  DEFAULT_RULES = [
    # Base rule: Skip all files by default (lowest priority, can be overridden)
    { rule_type: "pattern", value: "*", action: "skip", description: "All files (enable categories below)", priority: 1 },

    # Temporary/system files - always skip (highest priority, cannot be overridden)
    { rule_type: "pattern", value: "~$*", action: "skip", description: "Office temp files", priority: 100 },
    { rule_type: "pattern", value: "*.tmp", action: "skip", description: "Temporary files", priority: 100 },
    { rule_type: "pattern", value: ".DS_Store", action: "skip", description: "macOS metadata", priority: 100 },
    { rule_type: "pattern", value: "Thumbs.db", action: "skip", description: "Windows thumbnails", priority: 100 },
    { rule_type: "pattern", value: "desktop.ini", action: "skip", description: "Windows folder settings", priority: 100 },

    # Size limit - skip very large files
    { rule_type: "size", value: "500MB", action: "skip", description: "Files over 500MB", priority: 90 }
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

  # Get file categories with enabled status for a user
  def self.categories_for_user(user)
    return [] unless user

    # Get user's enabled categories (stored as "include" rules for category extensions)
    user_rules = for_user(user).include_rules.where(rule_type: "category").pluck(:value)

    FILE_CATEGORIES.map do |key, category|
      {
        key: key.to_s,
        name: category[:name],
        description: category[:description],
        extensions: category[:extensions],
        enabled: user_rules.include?(key.to_s)
      }
    end
  end

  # Enable a category for a user
  def self.enable_category(user, category_key)
    return false unless FILE_CATEGORIES.key?(category_key.to_sym)

    find_or_create_by!(
      user: user,
      rule_type: "category",
      value: category_key.to_s
    ) do |rule|
      rule.action = "include"
      rule.description = FILE_CATEGORIES[category_key.to_sym][:name]
      rule.priority = 50
    end
    true
  end

  # Disable a category for a user
  def self.disable_category(user, category_key)
    for_user(user).where(rule_type: "category", value: category_key.to_s).destroy_all
    true
  end

  # ==========================================
  # FOLDER SCOPES (Opt-in sync for folders)
  # ==========================================

  # Get folder scopes with enabled status for a user
  def self.folder_scopes_for_user(user)
    return [] unless user

    # Get user's enabled folder scopes
    user_rules = for_user(user).include_rules.where(rule_type: "folder_scope").pluck(:value)

    # Get storage configuration for folder paths
    config = StorageConfiguration.instance

    FOLDER_SCOPES.map do |key, scope|
      folder_path = config.root_folder_for(scope[:warehouse_type])
      {
        key: key.to_s,
        name: scope[:name],
        description: scope[:description],
        icon: scope[:icon],
        warehouse_type: scope[:warehouse_type],
        folder_path: folder_path,
        enabled: user_rules.include?(key.to_s)
      }
    end
  end

  # Enable a folder scope for a user
  def self.enable_folder_scope(user, scope_key)
    return false unless FOLDER_SCOPES.key?(scope_key.to_sym)

    find_or_create_by!(
      user: user,
      rule_type: "folder_scope",
      value: scope_key.to_s
    ) do |rule|
      rule.action = "include"
      rule.description = FOLDER_SCOPES[scope_key.to_sym][:name]
      rule.priority = 50
    end
    true
  end

  # Disable a folder scope for a user
  def self.disable_folder_scope(user, scope_key)
    for_user(user).where(rule_type: "folder_scope", value: scope_key.to_s).destroy_all
    true
  end

  # Get enabled folder scopes for a user
  def self.enabled_folder_scopes(user)
    return [] unless user
    for_user(user).include_rules.where(rule_type: "folder_scope").pluck(:value)
  end

  # Check if a folder scope is enabled for a user
  def self.folder_scope_enabled?(user, scope_key)
    return false unless user
    for_user(user).include_rules.where(rule_type: "folder_scope", value: scope_key.to_s).exists?
  end

  # Check if a file should sync based on enabled categories
  def self.should_sync_file?(user, filename, file_size = nil)
    # Always skip temp/system files
    DEFAULT_RULES.each do |rule|
      next unless rule[:priority] >= 90 && rule[:action] == "skip"
      return false if matches_rule?(rule, filename, file_size)
    end

    # Check size limit
    if file_size && file_size > 500.megabytes
      return false
    end

    # Get user's enabled categories
    enabled_categories = for_user(user).include_rules.where(rule_type: "category").pluck(:value)
    return false if enabled_categories.empty?

    # Check if file extension matches any enabled category
    ext = File.extname(filename).downcase
    enabled_categories.any? do |cat_key|
      category = FILE_CATEGORIES[cat_key.to_sym]
      category && category[:extensions].include?(ext)
    end
  end

  # Helper to match a rule hash against a file
  def self.matches_rule?(rule, filename, file_size)
    case rule[:rule_type]
    when "pattern"
      pattern = rule[:value].gsub(".", "\\.").gsub("*", ".*").gsub("?", ".")
      filename.match?(/^#{pattern}$/i)
    when "size"
      file_size && file_size > parse_size(rule[:value])
    when "extension"
      File.extname(filename).downcase == rule[:value].downcase
    else
      false
    end
  end

  # Parse size string to bytes
  def self.parse_size(size_str)
    match = size_str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
    return 0 unless match

    number = match[1].to_f
    unit = match[2].upcase

    case unit
    when "B" then number.to_i
    when "KB" then (number * 1024).to_i
    when "MB" then (number * 1024 * 1024).to_i
    when "GB" then (number * 1024 * 1024 * 1024).to_i
    else 0
    end
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
