# ESignaturePdfStamper - Applies signatures to PDF documents
#
# Uses HexaPDF to:
# - Stamp signature images onto the PDF
# - Add signature metadata (timestamp, IP, signer info)
# - Add completion certificate page
#
# Compliant with eIDAS, ESIGN Act, Australian ETA requirements
#
class ESignaturePdfStamper
  SIGNATURE_HEIGHT = 50
  SIGNATURE_WIDTH = 200
  MARGIN = 40
  FOOTER_HEIGHT = 80

  def initialize(request)
    @request = request
  end

  # Apply all signatures to the document and return stamped PDF content
  def stamp!
    pdf_content = fetch_original_document
    return nil unless pdf_content

    # Parse the PDF
    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))

    # Add signature footer to each page
    document.pages.each_with_index do |page, index|
      add_signature_footer(page, index + 1, document.pages.count)
    end

    # Add completion certificate as final page
    add_certificate_page(document) if @request.status == "completed"

    # Write to string
    output = StringIO.new
    document.write(output)
    output.string
  end

  # Apply a single signature to the document (during signing ceremony)
  def apply_signature(signer, signature_data, signature_type)
    pdf_content = fetch_current_document
    return nil unless pdf_content

    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))

    # Find the last page for signature placement
    last_page = document.pages.last
    box = last_page.box

    # Calculate signature position (bottom of page, based on signer order)
    y_position = MARGIN + (signer.signing_order * (SIGNATURE_HEIGHT + 20))

    # Create signature annotation
    add_signature_annotation(
      document,
      last_page,
      signature_data,
      signature_type,
      signer,
      MARGIN,
      y_position
    )

    # Write and return
    output = StringIO.new
    document.write(output)
    output.string
  end

  private

  def fetch_original_document
    return nil unless @request.original_sharepoint_file_id.present?

    begin
      client = MicrosoftAppGraphClient.new
      client.get_drive_item_content(
        site_id: @request.sharepoint_site_id,
        drive_id: @request.sharepoint_drive_id,
        item_id: @request.original_sharepoint_file_id
      )
    rescue StandardError => e
      Rails.logger.error("ESignaturePdfStamper: Failed to fetch original document: #{e.message}")
      nil
    end
  end

  def fetch_current_document
    # If we have a signed version, use that, otherwise use original
    if @request.signed_sharepoint_file_id.present?
      begin
        client = MicrosoftAppGraphClient.new
        client.get_drive_item_content(
          site_id: @request.sharepoint_site_id,
          drive_id: @request.sharepoint_drive_id,
          item_id: @request.signed_sharepoint_file_id
        )
      rescue StandardError => e
        Rails.logger.error("ESignaturePdfStamper: Failed to fetch signed document: #{e.message}")
        fetch_original_document
      end
    else
      fetch_original_document
    end
  end

  def add_signature_footer(page, page_number, total_pages)
    canvas = page.canvas(type: :overlay)
    box = page.box

    # Draw footer background
    canvas.fill_color("f5f5f5")
    canvas.rectangle(0, 0, box.width, FOOTER_HEIGHT)
    canvas.fill

    # Draw separator line
    canvas.stroke_color("cccccc")
    canvas.line(MARGIN, FOOTER_HEIGHT, box.width - MARGIN, FOOTER_HEIGHT)
    canvas.stroke

    # Add request info
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")

    y = FOOTER_HEIGHT - 15
    canvas.text("Document: #{@request.title}", at: [ MARGIN, y ])
    canvas.text("Request: #{@request.request_number}", at: [ MARGIN, y - 12 ])
    canvas.text("Page #{page_number} of #{total_pages}", at: [ box.width - MARGIN - 60, y ])

    # Add status indicator
    status_color = @request.status == "completed" ? "22c55e" : "f59e0b"
    canvas.fill_color(status_color)
    canvas.text(@request.status.upcase, at: [ box.width - MARGIN - 60, y - 12 ])
  end

  def add_signature_annotation(document, page, signature_data, signature_type, signer, x, y)
    canvas = page.canvas(type: :overlay)

    # Draw signature box
    canvas.stroke_color("000000")
    canvas.rectangle(x, y, SIGNATURE_WIDTH, SIGNATURE_HEIGHT)
    canvas.stroke

    # Add signature image if drawn/uploaded
    if signature_data.present? && signature_data.start_with?("data:image")
      begin
        # Decode base64 image
        image_data = signature_data.split(",")[1]
        image_bytes = Base64.decode64(image_data)

        # Create temp file and add to PDF
        Tempfile.create([ "sig", ".png" ]) do |temp|
          temp.binmode
          temp.write(image_bytes)
          temp.rewind

          image = document.images.add(temp.path)
          canvas.image(
            image,
            at: [ x + 5, y + 5 ],
            width: SIGNATURE_WIDTH - 10,
            height: SIGNATURE_HEIGHT - 20
          )
        end
      rescue StandardError => e
        Rails.logger.error("ESignaturePdfStamper: Failed to add signature image: #{e.message}")
        # Fall back to text
        canvas.font("Helvetica", size: 12)
        canvas.fill_color("000000")
        canvas.text(signer.name, at: [ x + 10, y + SIGNATURE_HEIGHT - 25 ])
      end
    else
      # Text signature
      canvas.font("Helvetica", size: 12)
      canvas.fill_color("000000")
      canvas.text(signer.name, at: [ x + 10, y + SIGNATURE_HEIGHT - 25 ])
    end

    # Add signature metadata below
    canvas.font("Helvetica", size: 6)
    canvas.fill_color("666666")
    canvas.text("Signed by: #{signer.name}", at: [ x + 5, y - 8 ])
    canvas.text("Date: #{signer.signed_at&.strftime('%Y-%m-%d %H:%M:%S UTC')}", at: [ x + 5, y - 15 ])
    canvas.text("IP: #{signer.ip_address}", at: [ x + 5, y - 22 ])
  end

  def add_certificate_page(document)
    # Add a new page for the completion certificate
    page = document.pages.add
    box = page.box
    canvas = page.canvas

    # Title
    canvas.font("Helvetica-Bold", size: 24)
    canvas.fill_color("000000")
    canvas.text("Certificate of Completion", at: [ box.width / 2 - 100, box.height - 80 ])

    # Certificate number
    cert = @request.certificate
    if cert
      canvas.font("Helvetica", size: 10)
      canvas.fill_color("666666")
      canvas.text("Certificate #: #{cert.certificate_number}", at: [ MARGIN, box.height - 120 ])
    end

    # Document info
    y = box.height - 160
    canvas.font("Helvetica-Bold", size: 12)
    canvas.fill_color("000000")
    canvas.text("Document Details", at: [ MARGIN, y ])

    canvas.font("Helvetica", size: 10)
    y -= 20
    canvas.text("Title: #{@request.title}", at: [ MARGIN, y ])
    y -= 15
    canvas.text("Request Number: #{@request.request_number}", at: [ MARGIN, y ])
    y -= 15
    canvas.text("Created: #{@request.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}", at: [ MARGIN, y ])
    y -= 15
    canvas.text("Completed: #{@request.completed_at&.strftime('%Y-%m-%d %H:%M:%S UTC')}", at: [ MARGIN, y ])

    # Document hashes
    y -= 30
    canvas.font("Helvetica-Bold", size: 12)
    canvas.text("Document Integrity", at: [ MARGIN, y ])

    canvas.font("Courier", size: 8)
    y -= 20
    canvas.text("Original Hash (SHA-256):", at: [ MARGIN, y ])
    y -= 12
    canvas.text(@request.original_document_hash || "N/A", at: [ MARGIN, y ])
    y -= 15
    canvas.text("Signed Hash (SHA-256):", at: [ MARGIN, y ])
    y -= 12
    canvas.text(@request.signed_document_hash || "N/A", at: [ MARGIN, y ])

    # Signers list
    y -= 30
    canvas.font("Helvetica-Bold", size: 12)
    canvas.text("Signatories", at: [ MARGIN, y ])

    canvas.font("Helvetica", size: 10)
    @request.signers.signed.order(:signing_order).each do |signer|
      y -= 20
      canvas.text(
        "#{signer.name} (#{signer.email}) - #{signer.role || 'Signer'}",
        at: [ MARGIN, y ]
      )
      y -= 12
      canvas.font("Helvetica", size: 8)
      canvas.fill_color("666666")
      canvas.text(
        "Signed: #{signer.signed_at&.strftime('%Y-%m-%d %H:%M:%S UTC')} | IP: #{signer.ip_address}",
        at: [ MARGIN + 20, y ]
      )
      canvas.fill_color("000000")
      canvas.font("Helvetica", size: 10)
    end

    # Legal notice
    y -= 40
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    canvas.text(
      "This document was electronically signed using TEEEM E-Signature. Electronic signatures are legally binding",
      at: [ MARGIN, y ]
    )
    y -= 10
    canvas.text(
      "under the Electronic Signatures in Global and National Commerce Act (E-SIGN), the Uniform Electronic",
      at: [ MARGIN, y ]
    )
    y -= 10
    canvas.text(
      "Transactions Act (UETA), and equivalent legislation in applicable jurisdictions.",
      at: [ MARGIN, y ]
    )

    # Verification URL
    y -= 25
    canvas.font("Helvetica", size: 9)
    canvas.fill_color("0066cc")
    canvas.text(
      "Verify this document at: #{Rails.application.routes.url_helpers.root_url}verify/#{cert&.certificate_number}",
      at: [ MARGIN, y ]
    )
  end
end
