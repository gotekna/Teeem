# frozen_string_literal: true

# ESignatureCertificate is the completion certificate that proves
# the document was signed by all parties. It contains the SHA256
# hash chain for tamper detection and a summary of all signatures.
#
class ESignatureCertificate < ApplicationRecord
  # Associations
  belongs_to :e_signature_request

  # Validations
  validates :certificate_number, presence: true, uniqueness: true
  validates :original_document_hash, presence: true
  validates :signed_document_hash, presence: true

  # Callbacks
  before_validation :generate_certificate_number, on: :create
  before_validation :generate_verification_token, on: :create

  # Class methods
  def self.generate_for!(request)
    return nil unless request.status == "completed"
    return request.certificate if request.certificate.present?

    signers_summary = request.signers.signed.order(:signed_at).map do |signer|
      {
        name: signer.name,
        email: signer.email,
        role: signer.role,
        signed_at: signer.signed_at.iso8601,
        ip_address: signer.ip_address,
        signature_type: signer.signature_type
      }
    end

    # Build signature chain
    signature_chain = build_signature_chain(request)

    create!(
      e_signature_request: request,
      original_document_hash: request.original_document_hash,
      signed_document_hash: request.signed_document_hash || calculate_final_hash(request),
      signature_chain: signature_chain.to_json,
      signers_summary: signers_summary,
      generated_at: Time.current
    )
  end

  def self.build_signature_chain(request)
    chain = []
    previous_hash = request.original_document_hash

    request.signers.signed.order(:signed_at).each do |signer|
      signature_hash = Digest::SHA256.hexdigest(signer.signature_data.to_s)
      combined_hash = Digest::SHA256.hexdigest("#{previous_hash}:#{signature_hash}:#{signer.signed_at.iso8601}")

      chain << {
        signer_id: signer.id,
        signer_name: signer.name,
        signer_email: signer.email,
        hash_before: previous_hash,
        signature_hash: signature_hash,
        hash_after: combined_hash,
        timestamp: signer.signed_at.iso8601
      }

      previous_hash = combined_hash
    end

    chain
  end

  def self.calculate_final_hash(request)
    chain = build_signature_chain(request)
    chain.last&.dig(:hash_after) || request.original_document_hash
  end

  # Instance methods
  def parsed_signature_chain
    @parsed_signature_chain ||= JSON.parse(signature_chain || "[]")
  end

  def verify_integrity!
    # Verify the signature chain
    errors = []

    chain = parsed_signature_chain
    expected_hash = original_document_hash

    chain.each_with_index do |link, index|
      if link["hash_before"] != expected_hash
        errors << "Chain broken at position #{index}: expected hash_before #{expected_hash}, got #{link['hash_before']}"
      end

      # Recalculate the hash
      recalculated = Digest::SHA256.hexdigest(
        "#{link['hash_before']}:#{link['signature_hash']}:#{link['timestamp']}"
      )

      if link["hash_after"] != recalculated
        errors << "Chain broken at position #{index}: hash mismatch for #{link['signer_name']}"
      end

      expected_hash = link["hash_after"]
    end

    # Final hash should match
    if expected_hash != signed_document_hash
      errors << "Final hash mismatch: expected #{signed_document_hash}, calculated #{expected_hash}"
    end

    {
      valid: errors.empty?,
      errors: errors,
      chain_length: chain.length,
      verified_at: Time.current.iso8601
    }
  end

  def verification_url
    return nil unless verification_token.present?

    # This URL would be configured based on your frontend domain
    "#{Rails.application.config.frontend_url}/verify-signature/#{verification_token}"
  rescue StandardError
    nil
  end

  def to_certificate_data
    {
      certificate_number: certificate_number,
      request_number: e_signature_request.request_number,
      title: e_signature_request.title,
      original_document_hash: original_document_hash,
      signed_document_hash: signed_document_hash,
      generated_at: generated_at.iso8601,
      verification_url: verification_url,
      signers: signers_summary,
      signature_chain: parsed_signature_chain,
      integrity_check: verify_integrity!
    }
  end

  # Generate PDF certificate
  def generate_pdf
    # Use HexaPDF to generate the certificate
    pdf = HexaPDF::Document.new
    page = pdf.pages.add([ 0, 0, 595, 842 ])  # A4 size
    canvas = page.canvas

    # Title
    canvas.font("Helvetica", size: 24)
    canvas.text("Certificate of Completion", at: [ 72, 770 ])

    # Certificate details
    canvas.font("Helvetica", size: 12)
    y = 720

    details = [
      [ "Certificate Number:", certificate_number ],
      [ "Request Number:", e_signature_request.request_number ],
      [ "Document Title:", e_signature_request.title ],
      [ "Completed:", generated_at.strftime("%d %B %Y at %I:%M %p") ],
      [ "", "" ],
      [ "Document Integrity:", "" ],
      [ "Original Hash:", original_document_hash[0..20] + "..." ],
      [ "Signed Hash:", signed_document_hash[0..20] + "..." ]
    ]

    details.each do |label, value|
      canvas.text("#{label} #{value}", at: [ 72, y ])
      y -= 20
    end

    # Signers section
    y -= 20
    canvas.font("Helvetica", size: 14)
    canvas.text("Signers:", at: [ 72, y ])
    y -= 25

    canvas.font("Helvetica", size: 10)
    signers_summary.each do |signer|
      canvas.text(
        "#{signer['name']} (#{signer['email']}) - Signed: #{signer['signed_at']}",
        at: [ 72, y ]
      )
      y -= 15
    end

    # Footer
    canvas.font("Helvetica", size: 8)
    canvas.text(
      "This certificate was automatically generated by TEEEM E-Signature System",
      at: [ 72, 50 ]
    )
    canvas.text(
      "Verify at: #{verification_url}",
      at: [ 72, 38 ]
    )

    # Return PDF as binary string
    io = StringIO.new
    pdf.write(io)
    io.string
  end

  private

  def generate_certificate_number
    return if certificate_number.present?

    year = Date.current.year
    prefix = "ESC-#{year}-"

    max = ESignatureCertificate
      .where("certificate_number LIKE ?", "#{prefix}%")
      .pluck(:certificate_number)
      .map { |n| n.sub(prefix, "").to_i }
      .max || 0

    self.certificate_number = "#{prefix}#{(max + 1).to_s.rjust(5, '0')}"
  end

  def generate_verification_token
    return if verification_token.present?

    self.verification_token = SecureRandom.urlsafe_base64(32)
  end
end
