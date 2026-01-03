class ApplyEmailRulesJob < ApplicationJob
  queue_as :default

  # Apply email rules to existing emails
  # SSoT: Supports both IMAP (credential_id) and MS365 (microsoft_credential_id)
  # @param user_id [Integer] The user whose rules to apply
  # @param options [Hash] Optional parameters
  # @option options [Integer] :credential_id IMAP credential ID to filter emails
  # @option options [Integer] :microsoft_credential_id MS365 credential ID to filter emails
  # @option options [Integer] :rule_id Apply specific rule only
  def perform(user_id, options = {})
    user = User.find(user_id)
    service = EmailRuleService.new(user)

    results = service.apply_rules_to_existing(
      credential_id: options[:credential_id],
      microsoft_credential_id: options[:microsoft_credential_id],
      rule_id: options[:rule_id]
    )

    Rails.logger.info "[ApplyEmailRulesJob] User #{user_id}: processed=#{results[:processed]}, matched=#{results[:matched]}, errors=#{results[:errors]}"

    results
  end
end
