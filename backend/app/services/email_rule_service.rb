class EmailRuleService
  attr_reader :user

  def initialize(user)
    @user = user
  end

  # Apply rules to a single email (called during sync)
  # SSoT: Works for both IMAP and MS365 emails - uses for_email scope
  # @param email [SyncedEmail] The email to apply rules to
  # @return [Boolean] Whether any rule matched
  def apply_rules(email)
    # SSoT: for_email scope handles both IMAP and MS365 credentials
    rules = EmailRule.active.by_priority.for_email(email)

    rules.each do |rule|
      if rule.matches?(email)
        should_stop = rule.apply_to!(email)
        return true if should_stop
      end
    end

    false
  end

  # Apply rules to multiple emails (retroactive)
  # SSoT: Supports both IMAP (credential_id) and MS365 (microsoft_credential_id)
  # @param credential_id [Integer, nil] IMAP credential ID to filter emails
  # @param microsoft_credential_id [Integer, nil] MS365 credential ID to filter emails
  # @param rule_id [Integer, nil] Optional rule ID to apply specific rule
  # @return [Hash] Results of the operation
  def apply_rules_to_existing(credential_id: nil, microsoft_credential_id: nil, rule_id: nil)
    results = { matched: 0, processed: 0, errors: 0 }

    emails = user.synced_emails
    emails = emails.where(imap_credential_id: credential_id) if credential_id
    emails = emails.where(microsoft_credential_id: microsoft_credential_id) if microsoft_credential_id

    rules = if rule_id
              EmailRule.where(id: rule_id, user: user).active
            elsif credential_id
              EmailRule.active.by_priority.for_account(credential_id)
            elsif microsoft_credential_id
              EmailRule.active.by_priority.for_ms365_account(microsoft_credential_id)
            else
              # Apply all global rules (nil credentials)
              EmailRule.active.by_priority.where(imap_credential_id: nil, microsoft_credential_id: nil)
            end

    return results if rules.empty?

    emails.find_each do |email|
      begin
        rules.each do |rule|
          if rule.matches?(email)
            rule.apply_to!(email)
            results[:matched] += 1
            break if rule.stop_processing
          end
        end
        results[:processed] += 1
      rescue => e
        Rails.logger.error "[EmailRuleService] Error applying rules to email #{email.id}: #{e.message}"
        results[:errors] += 1
      end
    end

    results
  end

  # Test rules against sample emails without applying actions
  # @param rule_params [Hash] Rule conditions to test
  # @param limit [Integer] Maximum emails to test
  # @return [Hash] Test results
  def test_rule(rule_params, limit: 100)
    rule = EmailRule.new(rule_params.merge(user: user))

    emails = user.synced_emails.limit(limit)
    matches = emails.select { |e| rule.matches?(e) }

    {
      total_tested: emails.count,
      matches_count: matches.count,
      sample_matches: matches.first(5).map do |e|
        {
          id: e.id,
          subject: e.subject,
          from_email: e.from_email,
          received_at: e.received_at
        }
      end
    }
  end
end
