class ContactExternalLink < ApplicationRecord
  include ExternalSyncConstants

  belongs_to :contact

  # Callbacks to keep Contact's cached xero columns in sync
  after_save :update_contact_xero_cache
  after_destroy :update_contact_xero_cache
  # FRC (Feb 2026): Ensure tenant_name is never blank - resolve from XeroCredential
  before_validation :ensure_tenant_name

  # SSoT: ACCOUNTING_SYSTEMS, RECORD_SYNC_DIRECTIONS, MATCH_TYPES defined in ExternalSyncConstants concern

  # Xero contact status tracking
  XERO_STATUSES = %w[active archived deleted not_found].freeze

  validates :source, presence: true, inclusion: { in: ACCOUNTING_SYSTEMS }
  validates :xero_contact_status, inclusion: { in: XERO_STATUSES }, allow_nil: true
  # FRC (Feb 2026): Renamed from tenant_id to xero_org_id for consistency
  # xero_org_id stores the Xero organization UUID, not TEEEM tenant FK
  validates :xero_org_id, presence: true
  validates :external_contact_id, presence: true
  validates :sync_direction, inclusion: { in: RECORD_SYNC_DIRECTIONS }
  # NOTE: Removed contact_id uniqueness validation to support merged Xero contacts
  # One TEEEM contact CAN have multiple Xero links (e.g., "Bunnings" and "Bunnings Group Limited" after merge)
  validates :external_contact_id, uniqueness: { scope: [ :source, :xero_org_id ], message: "already linked to another contact" }

  scope :enabled, -> { where(sync_enabled: true) }
  # SSoT: source scopes (xero, myob, quickbooks, for_source) defined in ExternalSyncConstants
  # FRC (Feb 2026): Renamed from for_tenant to for_xero_org for consistency
  scope :for_xero_org, ->(xero_org_id) { where(xero_org_id: xero_org_id) }
  scope :with_errors, -> { where.not(sync_error: nil) }
  scope :with_conflicts, -> { where("conflict_fields != '{}'") }
  scope :pending_review, -> { where(needs_review: true) }
  scope :reviewed, -> { where(needs_review: false).where.not(reviewed_at: nil) }
  scope :active_status, -> { where(xero_contact_status: 'active') }
  scope :stale_status, -> { where(xero_contact_status: ['archived', 'deleted', 'not_found']) }
  scope :unverified_since, ->(timestamp) { where("last_verified_at < ? OR last_verified_at IS NULL", timestamp) }

  # Check if this link has sync conflicts
  def has_conflicts?
    conflict_fields.present? && conflict_fields.any?
  end

  # Clear sync error
  def clear_error!
    update!(sync_error: nil)
  end

  # Record sync error
  def record_error!(message)
    update!(sync_error: message)
  end

  # Mark as synced
  def mark_synced!(external_modified_at = nil)
    update!(
      last_synced_at: Time.current,
      external_last_modified_at: external_modified_at,
      sync_error: nil
    )
  end

  # Mark as verified (contact exists and is active in external system)
  def mark_verified!
    update!(
      xero_contact_status: 'active',
      last_verified_at: Time.current
    )
  end

  # Mark as stale (contact not found in external system)
  def mark_stale!(status = 'not_found')
    raise ArgumentError, "Invalid status: #{status}" unless XERO_STATUSES.include?(status)
    update!(xero_contact_status: status)
  end

  # Check if this link is stale
  def stale?
    %w[archived deleted not_found].include?(xero_contact_status)
  end

  # Check if this link is active
  def active_status?
    xero_contact_status == 'active'
  end

  # Add a conflict field
  def add_conflict(field_name, teeem_value, external_value)
    conflicts = conflict_fields || {}
    conflicts[field_name] = {
      "teeem_value" => teeem_value,
      "external_value" => external_value,
      "detected_at" => Time.current.iso8601
    }
    update!(conflict_fields: conflicts)
  end

  # Resolve a conflict (choose which value to keep)
  def resolve_conflict(field_name, keep_source) # keep_source: 'teeem' or 'external'
    conflicts = conflict_fields || {}
    conflicts.delete(field_name)
    update!(conflict_fields: conflicts)
  end

  # Import only?
  def import_only?
    sync_direction == "import_only"
  end

  # Export only?
  def export_only?
    sync_direction == "export_only"
  end

  # Bidirectional sync?
  def bidirectional?
    sync_direction == "bidirectional"
  end

  # Can import from external system?
  def can_import?
    sync_enabled? && (import_only? || bidirectional?)
  end

  # Can export to external system?
  def can_export?
    sync_enabled? && (export_only? || bidirectional?)
  end

  # Convenience: is this a Xero link?
  def xero?
    source == "xero"
  end

  # Convenience: is this a MYOB link?
  def myob?
    source == "myob"
  end

  # Convenience: is this a QuickBooks link?
  def quickbooks?
    source == "quickbooks"
  end

  # Approve a fuzzy match review
  # Recalculates match_confidence based on current names to fix stale values
  def approve_review!(reviewer_email = nil)
    # Recalculate match confidence now that link is confirmed
    new_confidence = calculate_match_confidence

    update!(
      needs_review: false,
      sync_enabled: true,
      reviewed_at: Time.current,
      reviewed_by: reviewer_email,
      match_confidence: new_confidence,
      match_type: "manual"  # Mark as manually reviewed
    )
  end

  # Check if this link was auto-matched (not manually linked)
  def auto_matched?
    match_type.present? && match_type != "manual"
  end

  # Check if this was a high-confidence match
  def high_confidence?
    match_confidence.present? && match_confidence >= 0.95
  end

  # Check if this was a fuzzy match
  def fuzzy_match?
    match_type == "fuzzy_name"
  end

  private

  # Calculate match confidence between contact display_name and external_name
  # Uses same algorithm as XeroContactSyncService for consistency
  def calculate_match_confidence
    return 1.0 unless contact && external_name.present? && contact.display_name.present?

    name1 = external_name.to_s.downcase.gsub(/\s+/, " ").strip
    name2 = contact.display_name.to_s.downcase.gsub(/\s+/, " ").strip

    return 1.0 if name1 == name2

    shorter, longer = [ name1, name2 ].sort_by(&:length)

    # Prefix match: if shorter name is prefix of longer, high confidence
    if longer.start_with?(shorter)
      prefix_ratio = shorter.length.to_f / longer.length
      return 0.85 + (prefix_ratio * 0.14)  # 85% to 99%
    end

    # Substring match
    if longer.include?(shorter)
      prefix_ratio = shorter.length.to_f / longer.length
      return 0.70 + (prefix_ratio * 0.15)  # 70% to 85%
    end

    # Fall back to Levenshtein distance for fuzzy matching
    distance = levenshtein_distance(name1, name2)
    max_len = [ name1.length, name2.length ].max
    return 1.0 if max_len.zero?

    1.0 - (distance.to_f / max_len)
  end

  # Simple Levenshtein distance implementation
  def levenshtein_distance(s1, s2)
    m = s1.length
    n = s2.length
    return m if n.zero?
    return n if m.zero?

    d = Array.new(m + 1) { Array.new(n + 1) }
    (0..m).each { |i| d[i][0] = i }
    (0..n).each { |j| d[0][j] = j }

    (1..m).each do |i|
      (1..n).each do |j|
        cost = s1[i - 1] == s2[j - 1] ? 0 : 1
        d[i][j] = [ d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost ].min
      end
    end

    d[m][n]
  end

  # FRC (Feb 2026): Ensure tenant_name is populated from XeroCredential when blank.
  # Root cause: Ruby's `"" || "Unknown"` returns "" because empty string is truthy.
  # This guardrail catches any creation path that fails to set tenant_name.
  def ensure_tenant_name
    return if tenant_name.present?
    return unless xero_org_id.present?

    cred = XeroCredential.find_by(tenant_id: xero_org_id)
    self.tenant_name = cred&.tenant_name.presence || "Unknown"
  end

  # Update the contact's cached xero columns
  def update_contact_xero_cache
    return unless contact && xero?

    contact.update_xero_link_cache!
  end
end
