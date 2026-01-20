# EmailPreloaderService - Bulk loads associated data for email API responses
#
# Part of 6-month email performance masterpiece plan
# Impact: 150+ queries per page → 5 queries per page
#
# Usage:
#   emails = SyncedEmail.includes(:job).limit(50)
#   preloader = EmailPreloaderService.new(emails).preload_all
#
#   emails.map { |e| email_json(e, preloader: preloader) }
#
class EmailPreloaderService
  attr_reader :emails, :cache

  def initialize(emails)
    @emails = emails.to_a  # Materialize the relation
    @cache = {
      jobs: {},
      contacts: {},
      thread_counts: {},
      user_states: {}
    }
  end

  # Preload all associated data in bulk
  def preload_all
    preload_jobs
    preload_contacts
    preload_thread_counts
    self
  end

  # Preload including user-specific state (for starred, pinned, etc.)
  def preload_all_with_user_state(user)
    preload_all
    preload_user_states(user)
    self
  end

  # Get job for an email (from cache)
  def job_for(email)
    @cache[:jobs][email.job_id]
  end

  # Get primary contact for an email (from cache)
  def primary_contact_for(email)
    @cache[:contacts][email.primary_contact_id]
  end

  # Get all contacts for an email (from cache)
  def contacts_for(email)
    (email.contact_ids || []).filter_map { |id| @cache[:contacts][id] }
  end

  # Get thread count for an email (from cache)
  def thread_count_for(email)
    return 1 if email.conversation_id.blank?
    @cache[:thread_counts][email.conversation_id] || 1
  end

  # Get user state for an email (starred, pinned, etc.)
  def user_state_for(email)
    @cache[:user_states][email.id]
  end

  # Check if email is starred (for current user)
  def starred?(email)
    @cache[:user_states][email.id]&.is_starred || false
  end

  # Check if email is pinned (for current user)
  def pinned?(email)
    @cache[:user_states][email.id]&.is_pinned || false
  end

  private

  # Preload jobs for all emails with job_id
  def preload_jobs
    job_ids = @emails.map(&:job_id).compact.uniq
    return if job_ids.empty?

    @cache[:jobs] = Job.where(id: job_ids)
                       .select(:id, :job_number, :title, :name, :status)
                       .index_by(&:id)
  end

  # Preload contacts for all emails (primary + linked contacts)
  def preload_contacts
    all_contact_ids = @emails.flat_map do |e|
      [e.primary_contact_id, *(e.contact_ids || [])]
    end.compact.uniq

    return if all_contact_ids.empty?

    @cache[:contacts] = Contact.where(id: all_contact_ids)
                               .select(:id, :display_name, :email, :phone, :company_name)
                               .index_by(&:id)
  end

  # Preload thread counts for all emails with conversation_id
  def preload_thread_counts
    conversation_ids = @emails.map(&:conversation_id).compact.uniq
    return if conversation_ids.empty?

    @cache[:thread_counts] = SyncedEmail.where(conversation_id: conversation_ids)
                                           .group(:conversation_id)
                                           .count
  end

  # Preload user-specific state (starred, pinned, archived, reminders)
  def preload_user_states(user)
    return unless user

    email_ids = @emails.map(&:id)
    return if email_ids.empty?

    @cache[:user_states] = EmailUserState.where(
      synced_email_id: email_ids,
      user_id: user.id
    ).index_by(&:synced_email_id)
  end
end
