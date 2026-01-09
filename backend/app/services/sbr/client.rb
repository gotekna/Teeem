# frozen_string_literal: true

module Sbr
  # SBR (Standard Business Reporting) SOAP Client
  # Communicates with ATO's SBR Gateway for BAS/IAS/STP lodgements
  #
  # SSoT: This is THE client for all SBR communications
  #
  # Prerequisites:
  # 1. Register as DSP at https://softwaredevelopers.ato.gov.au/
  # 2. Obtain SBR certificates
  # 3. Configure environment variables (see SBR_CONFIG below)
  #
  class Client
    # Environment URLs
    EVTE_URL = "https://test.sbr.gov.au/services/sbr"
    PROD_URL = "https://sbr.gov.au/services/sbr"

    # Required environment variables
    SBR_CONFIG = %w[
      SBR_ENVIRONMENT
      SBR_DSP_ID
      SBR_SOFTWARE_ID
      SBR_CERT_PATH
      SBR_CERT_PASSWORD
    ].freeze

    class ConfigurationError < StandardError; end
    class AuthenticationError < StandardError; end
    class LodgementError < StandardError; end

    def initialize
      validate_configuration!
      @environment = ENV["SBR_ENVIRONMENT"] || "evte"
    end

    def self.configured?
      SBR_CONFIG.all? { |key| ENV[key].present? }
    end

    def self.environment
      ENV["SBR_ENVIRONMENT"] || "evte"
    end

    # Lodge a BAS return
    def lodge_bas(bas_message)
      call_service(:lodge, bas_message)
    end

    # Check lodgement status
    def check_status(reference)
      call_service(:status, { reference: reference })
    end

    # Prefill - get ATO data for a period
    def prefill(abn:, period:)
      call_service(:prefill, { abn: abn, period: period })
    end

    # Validate without lodging
    def validate(bas_message)
      call_service(:validate, bas_message)
    end

    private

    def validate_configuration!
      missing = SBR_CONFIG.reject { |key| ENV[key].present? }
      return if missing.empty?

      raise ConfigurationError, "Missing SBR configuration: #{missing.join(', ')}. " \
                                "Register as DSP at https://softwaredevelopers.ato.gov.au/"
    end

    def call_service(operation, message)
      # TODO: Implement when DSP registration is complete
      #
      # response = soap_client.call(operation) do
      #   message(message)
      # end
      #
      # parse_response(response)

      raise NotImplementedError, "SBR integration pending DSP registration. " \
                                 "See TEEEM_DOCS/ATO_SBR_INTEGRATION_GUIDE.md"
    end

    def soap_client
      # TODO: Implement when certificates are available
      #
      # Savon.client(
      #   wsdl: gateway_url,
      #   ssl_cert_file: certificate_path,
      #   ssl_cert_key_file: key_path,
      #   ssl_cert_key_password: ENV["SBR_CERT_PASSWORD"],
      #   ssl_verify_mode: :peer,
      #   log: Rails.env.development?,
      #   headers: sbr_headers
      # )

      nil
    end

    def gateway_url
      @environment == "production" ? PROD_URL : EVTE_URL
    end

    def certificate_path
      ENV["SBR_CERT_PATH"]
    end

    def sbr_headers
      {
        "X-SBR-SoftwareId" => ENV["SBR_SOFTWARE_ID"],
        "X-SBR-DspId" => ENV["SBR_DSP_ID"]
      }
    end
  end
end
