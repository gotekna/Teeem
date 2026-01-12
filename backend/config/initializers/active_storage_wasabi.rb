# frozen_string_literal: true

# Register the Wasabi service with ActiveStorage
# This allows using `service: Wasabi` in config/storage.yml
#
# SSoT: Credentials are read from S3CompatibleCredential.active (database)
# Rails expects custom ActiveStorage services in lib/active_storage/service/
# The service class will be auto-loaded when referenced in storage.yml
