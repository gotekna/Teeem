# frozen_string_literal: true

module Gl
  # Adapter factory for GL providers
  #
  # Usage:
  #   adapter = Gl::Adapters.for(corporate)
  #   adapter.sync_accounts
  #
  #   # Or with a specific credential
  #   adapter = Gl::Adapters.for(corporate, credential: my_credential)
  #
  module Adapters
    PROVIDER_ADAPTERS = {
      'xero' => 'Gl::Adapters::Xero',
      'quickbooks' => 'Gl::Adapters::QuickBooks',
      'myob' => 'Gl::Adapters::Myob'
    }.freeze

    class << self
      # Get the appropriate adapter for a corporate company
      #
      # If a credential is provided, uses that specific provider.
      # Otherwise, finds the first connected credential.
      # Falls back to Standalone if no credentials exist.
      #
      def for(corporate, credential: nil)
        credential ||= find_credential(corporate)

        if credential.nil?
          Standalone.new(corporate)
        else
          adapter_class_for(credential.provider).new(corporate, credential: credential)
        end
      end

      # Get adapter for a specific provider
      def for_provider(corporate, provider, tenant_id: nil)
        credential = Gl::ProviderCredential.find_by(
          corporate: corporate,
          provider: provider,
          tenant_id: tenant_id
        )

        if credential
          adapter_class_for(provider).new(corporate, credential: credential)
        else
          raise ArgumentError, "No credential found for provider: #{provider}"
        end
      end

      # Get all connected adapters for a company
      def all_for(corporate)
        credentials = Gl::ProviderCredential
          .where(corporate: corporate)
          .connected

        if credentials.empty?
          [Standalone.new(corporate)]
        else
          credentials.map do |credential|
            adapter_class_for(credential.provider).new(corporate, credential: credential)
          end
        end
      end

      # Check if a provider is supported
      def supported?(provider)
        PROVIDER_ADAPTERS.key?(provider.to_s.downcase)
      end

      # List supported providers
      def supported_providers
        PROVIDER_ADAPTERS.keys
      end

      private

      def find_credential(corporate)
        Gl::ProviderCredential
          .where(corporate: corporate)
          .connected
          .sync_enabled
          .first
      end

      def adapter_class_for(provider)
        class_name = PROVIDER_ADAPTERS[provider.to_s.downcase]
        raise ArgumentError, "Unsupported provider: #{provider}" unless class_name

        class_name.constantize
      rescue NameError
        raise ArgumentError, "Adapter not implemented: #{class_name}"
      end
    end
  end
end
