module Bpmn
  module Tasks
    # WaitForSignaturesTask - Pause workflow until e-signature request is completed
    #
    # This is a "wait" task that checks if the e-signature request is complete.
    # If not complete, it raises WaitingError to pause the token.
    # The workflow engine should periodically retry this task.
    #
    # Config options:
    #   request_variable: Variable name containing the request info (from CreateESignRequestTask)
    #   request_id: Direct request ID (alternative to request_variable)
    #   timeout_action: What to do on timeout - "fail" or "continue" (default: fail)
    #   store_result_as: Variable name to store completion result
    #
    class WaitForSignaturesTask < BaseTask
      class WaitingError < StandardError; end

      def execute
        request = find_request

        unless request
          # PermanentError: missing request won't reappear on retry.
          # Common cause: request was deleted or table was cleared.
          raise PermanentError, "E-signature request not found (may have been deleted). " \
            "Check e_signature_requests table for request referenced in process variables."
        end

        log_info("Checking e-signature status for #{request.request_number}: #{request.status}")

        case request.status
        when "completed"
          handle_completed(request)
        when "declined"
          handle_declined(request)
        when "expired"
          handle_expired(request)
        when "cancelled"
          handle_cancelled(request)
        when "draft", "sent", "in_progress"
          handle_waiting(request)
        else
          raise "Unknown request status: #{request.status}"
        end
      end

      private

      # ⚠️ NO FALLBACKS - Fail fast (2026-02-27)
      # ════════════════════════════════════════════════════════════════
      # Why: "Most recent request" fallback silently grabbed wrong requests
      #      when multiple director changes existed on same Corporate.
      #      Bugs stayed hidden until client reported wrong documents.
      # ❌ WRONG: @subject.e_signature_requests.order(:desc).first
      # ✅ CORRECT: Require explicit variable or config, fail if missing
      # ════════════════════════════════════════════════════════════════
      def find_request
        # Try from variable (set by CreateDirectorChangeEsignTask or CreateESignRequestTask)
        # FRC (Feb 2026): Default to "esign_result" when no request_variable configured.
        # CreateDirectorChangeEsignTask always stores as "esign_result" (line 77),
        # so this default covers the common case without requiring explicit node config.
        variable_name = @config["request_variable"].presence || "esign_result"
        request_info = @variables[variable_name]
        if request_info.is_a?(Hash) && request_info["request_id"].present?
          return ESignatureRequest.find_by(id: request_info["request_id"])
        end

        if @config["request_variable"].present?
          log_info("request_variable '#{variable_name}' is missing or invalid: #{request_info.inspect}")
        end

        # Try direct ID from node config
        if @config["request_id"].present?
          return ESignatureRequest.find_by(id: @config["request_id"])
        end

        log_info("No e-signature request found in variable '#{variable_name}' or config")
        nil
      end

      def handle_completed(request)
        log_info("E-signature request #{request.request_number} completed")

        store_result({
          status: "completed",
          request_number: request.request_number,
          completed_at: request.completed_at.iso8601,
          signed_document_hash: request.signed_document_hash,
          certificate_number: request.certificate&.certificate_number,
          signers: request.signers.map do |s|
            { name: s.name, email: s.email, signed_at: s.signed_at&.iso8601 }
          end
        })

        {
          success: true,
          status: "completed",
          request_number: request.request_number
        }
      end

      def handle_declined(request)
        decliner = request.signers.declined.first
        log_info("E-signature request #{request.request_number} declined by #{decliner&.name}")

        store_result({
          status: "declined",
          request_number: request.request_number,
          declined_by: decliner&.name,
          decline_reason: decliner&.decline_reason
        })

        # Raise error to fail the workflow (or handle differently based on config)
        raise "E-signature request declined by #{decliner&.name}: #{decliner&.decline_reason}"
      end

      def handle_expired(request)
        log_info("E-signature request #{request.request_number} expired")

        timeout_action = @config["timeout_action"] || "fail"

        store_result({
          status: "expired",
          request_number: request.request_number,
          expired_at: request.expires_at&.iso8601,
          signed_count: request.signed_count,
          total_signers: request.signers.count
        })

        if timeout_action == "continue"
          {
            success: false,
            status: "expired",
            request_number: request.request_number
          }
        else
          raise "E-signature request expired with #{request.pending_count} pending signatures"
        end
      end

      def handle_cancelled(request)
        log_info("E-signature request #{request.request_number} was cancelled")

        store_result({
          status: "cancelled",
          request_number: request.request_number
        })

        raise "E-signature request was cancelled"
      end

      def handle_waiting(request)
        progress = request.progress_percentage
        signed = request.signed_count
        total = request.signers.count

        log_info("Waiting for signatures: #{signed}/#{total} (#{progress}%)")

        # Check if expired
        if request.expires_at && request.expires_at < Time.current
          request.expire!
          return handle_expired(request.reload)
        end

        # Still waiting - raise WaitingError to pause the token
        raise WaitingError, "Waiting for signatures: #{signed}/#{total} complete"
      end

      def store_result(result)
        if @config["store_result_as"]
          set_variable(@config["store_result_as"], result)
        end
      end
    end
  end
end
