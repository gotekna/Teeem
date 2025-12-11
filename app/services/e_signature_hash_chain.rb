# ESignatureHashChain - Creates tamper-evident signature chains
#
# Implements a blockchain-like hash chain where each signature
# references the previous signature's hash, creating an immutable
# audit trail that can detect tampering.
#
# Chain structure:
# {
#   "version": 1,
#   "request_id": 123,
#   "request_number": "ESR-2024-00001",
#   "original_document_hash": "sha256...",
#   "chain": [
#     {
#       "index": 0,
#       "signer_id": 1,
#       "signer_name": "John Doe",
#       "signer_email": "john@example.com",
#       "timestamp": "2024-01-15T10:30:00Z",
#       "signature_hash": "sha256 of signature image data",
#       "document_hash_at_signing": "sha256 of document at time of signing",
#       "ip_address": "192.168.1.1",
#       "user_agent": "Mozilla/5.0...",
#       "previous_hash": null (for first) or "sha256 of previous entry",
#       "entry_hash": "sha256 of this entire entry"
#     },
#     ...
#   ],
#   "final_document_hash": "sha256...",
#   "completed_at": "2024-01-15T15:00:00Z"
# }
#
class ESignatureHashChain
  VERSION = 1

  class ChainValidationError < StandardError; end
  class TamperDetectedError < ChainValidationError; end

  def initialize(request)
    @request = request
  end

  # Build the complete signature chain
  def build_chain
    chain = {
      version: VERSION,
      request_id: @request.id,
      request_number: @request.request_number,
      original_document_hash: @request.original_document_hash,
      chain: build_signature_entries,
      final_document_hash: @request.signed_document_hash,
      completed_at: @request.completed_at&.iso8601
    }

    chain.to_json
  end

  # Verify the integrity of an existing chain
  def verify_chain(chain_json)
    chain = JSON.parse(chain_json, symbolize_names: true)

    # Verify version
    raise ChainValidationError, "Unknown chain version" unless chain[:version] == VERSION

    # Verify request matches
    unless chain[:request_id] == @request.id && chain[:request_number] == @request.request_number
      raise TamperDetectedError, "Request ID/number mismatch"
    end

    # Verify original document hash
    unless chain[:original_document_hash] == @request.original_document_hash
      raise TamperDetectedError, "Original document hash mismatch"
    end

    # Verify each entry in the chain
    previous_hash = nil
    chain[:chain].each_with_index do |entry, index|
      verify_chain_entry(entry, index, previous_hash)
      previous_hash = entry[:entry_hash]
    end

    # Verify final document hash
    if chain[:final_document_hash].present? && @request.signed_document_hash.present?
      unless chain[:final_document_hash] == @request.signed_document_hash
        raise TamperDetectedError, "Final document hash mismatch"
      end
    end

    true
  end

  # Add a new signature to the chain (returns updated chain)
  def add_signature(signer, signature_data, document_hash_at_signing)
    existing_chain = @request.certificate&.signature_chain
    chain = existing_chain.present? ? JSON.parse(existing_chain, symbolize_names: true) : initialize_chain

    previous_hash = chain[:chain].last&.dig(:entry_hash)

    new_entry = build_entry(
      signer: signer,
      signature_data: signature_data,
      document_hash: document_hash_at_signing,
      index: chain[:chain].length,
      previous_hash: previous_hash
    )

    chain[:chain] << new_entry
    chain.to_json
  end

  # Get a human-readable verification report
  def verification_report
    return nil unless @request.certificate&.signature_chain.present?

    chain = JSON.parse(@request.certificate.signature_chain, symbolize_names: true)

    report = []
    report << "E-Signature Verification Report"
    report << "================================"
    report << ""
    report << "Request: #{chain[:request_number]}"
    report << "Chain Version: #{chain[:version]}"
    report << ""
    report << "Document Integrity:"
    report << "  Original Hash: #{truncate_hash(chain[:original_document_hash])}"
    report << "  Final Hash: #{truncate_hash(chain[:final_document_hash])}"
    report << ""
    report << "Signature Chain (#{chain[:chain].length} signatures):"
    report << ""

    chain[:chain].each do |entry|
      report << "  #{entry[:index] + 1}. #{entry[:signer_name]} <#{entry[:signer_email]}>"
      report << "     Signed: #{entry[:timestamp]}"
      report << "     IP: #{entry[:ip_address]}"
      report << "     Entry Hash: #{truncate_hash(entry[:entry_hash])}"
      report << ""
    end

    begin
      verify_chain(@request.certificate.signature_chain)
      report << "VERIFICATION RESULT: VALID"
      report << "All signatures verified. Document has not been tampered with."
    rescue ChainValidationError => e
      report << "VERIFICATION RESULT: INVALID"
      report << "Error: #{e.message}"
    end

    report.join("\n")
  end

  private

  def initialize_chain
    {
      version: VERSION,
      request_id: @request.id,
      request_number: @request.request_number,
      original_document_hash: @request.original_document_hash,
      chain: [],
      final_document_hash: nil,
      completed_at: nil
    }
  end

  def build_signature_entries
    @request.signers.signed.order(:signing_order).map.with_index do |signer, index|
      # Get the event for this signature to retrieve document hash at that time
      sign_event = @request.events.find_by(
        e_signature_signer_id: signer.id,
        event_type: "signed"
      )

      previous_entry = index.positive? ? build_signature_entries[index - 1] : nil

      build_entry(
        signer: signer,
        signature_data: signer.signature_data,
        document_hash: sign_event&.document_hash,
        index: index,
        previous_hash: previous_entry&.dig(:entry_hash)
      )
    end
  end

  def build_entry(signer:, signature_data:, document_hash:, index:, previous_hash:)
    entry = {
      index: index,
      signer_id: signer.id,
      signer_name: signer.name,
      signer_email: signer.email,
      timestamp: signer.signed_at&.iso8601,
      signature_hash: signature_data.present? ? Digest::SHA256.hexdigest(signature_data) : nil,
      document_hash_at_signing: document_hash,
      ip_address: signer.ip_address,
      user_agent: signer.user_agent,
      previous_hash: previous_hash
    }

    # Calculate entry hash (hash of all entry data except entry_hash itself)
    entry[:entry_hash] = calculate_entry_hash(entry)
    entry
  end

  def calculate_entry_hash(entry)
    # Create canonical string representation for hashing
    canonical = [
      entry[:index],
      entry[:signer_id],
      entry[:signer_name],
      entry[:signer_email],
      entry[:timestamp],
      entry[:signature_hash],
      entry[:document_hash_at_signing],
      entry[:ip_address],
      entry[:user_agent],
      entry[:previous_hash]
    ].join("|")

    Digest::SHA256.hexdigest(canonical)
  end

  def verify_chain_entry(entry, expected_index, expected_previous_hash)
    # Verify index
    raise TamperDetectedError, "Entry #{expected_index}: index mismatch" unless entry[:index] == expected_index

    # Verify previous hash link
    unless entry[:previous_hash] == expected_previous_hash
      raise TamperDetectedError, "Entry #{expected_index}: previous hash mismatch - chain broken"
    end

    # Verify entry hash
    recalculated_hash = calculate_entry_hash(entry.except(:entry_hash))
    unless entry[:entry_hash] == recalculated_hash
      raise TamperDetectedError, "Entry #{expected_index}: entry hash mismatch - data tampered"
    end

    # Verify signer exists and matches
    signer = @request.signers.find_by(id: entry[:signer_id])
    raise TamperDetectedError, "Entry #{expected_index}: signer not found" unless signer

    unless signer.name == entry[:signer_name] && signer.email == entry[:signer_email]
      raise TamperDetectedError, "Entry #{expected_index}: signer details mismatch"
    end

    true
  end

  def truncate_hash(hash)
    return "N/A" if hash.blank?
    "#{hash[0..7]}...#{hash[-8..]}"
  end
end
