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

    # Check if we have positioned fields
    if @request.fields.any?
      # Stamp positioned fields at their defined locations
      stamp_positioned_fields(document)
    else
      # No positioned fields: stamp each signer's signature on the last page
      # DocuSign-style: signature + name + timestamp in a clean block
      stamp_legacy_signatures(document)
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
    ref = @request.original_storage_reference
    return nil unless ref.present?

    fetch_document_by_reference(ref, "original")
  end

  def fetch_current_document
    # If we have a signed version, use that, otherwise use original
    signed_ref = @request.signed_storage_reference
    if signed_ref.present?
      fetch_document_by_reference(signed_ref, "signed") || fetch_original_document
    else
      fetch_original_document
    end
  end

  # Fetch document from StorageBlob (S3/Wasabi) or SharePoint
  def fetch_document_by_reference(storage_ref, label)
    # Try StorageBlob first (S3/Wasabi)
    blob = StorageBlob.find_by(id: storage_ref)
    if blob
      return blob.download
    end

    # Fall back to SharePoint
    if @request.storage_site_id.present? && @request.storage_drive_id.present?
      client = MicrosoftAppGraphClient.new
      return client.get_drive_item_content(
        site_id: @request.storage_site_id,
        drive_id: @request.storage_drive_id,
        item_id: storage_ref
      )
    end

    nil
  rescue StandardError => e
    Rails.logger.error("ESignaturePdfStamper: Failed to fetch #{label} document: #{e.message}")
    nil
  end

  # Stamp signatures at the bottom of the last page (DocuSign-style).
  # Used for legacy requests without positioned fields (e.g., Director Changes).
  # Each signer gets: signature image (or typed name) + "Signed by" + timestamp.
  def stamp_legacy_signatures(document)
    signed_signers = @request.signers.signed.order(:signing_order).to_a
    return if signed_signers.empty?

    last_page = document.pages.last
    box = last_page.box
    canvas = last_page.canvas(type: :overlay)

    block_height = 65
    total_height = (signed_signers.size * block_height) + 30
    x_start = MARGIN
    y_start = MARGIN

    # White background behind entire signature area
    canvas.fill_color("ffffff")
    canvas.rectangle(x_start - 5, y_start - 5, box.width - (MARGIN * 2) + 10, total_height + 10)
    canvas.fill

    # Divider line
    canvas.stroke_color("cccccc")
    canvas.line(x_start, y_start + total_height - 5, box.width - MARGIN, y_start + total_height - 5)
    canvas.stroke

    # "Signatures" header
    canvas.font("Helvetica", variant: :bold, size: 10)
    canvas.fill_color("333333")
    canvas.text("Signatures", at: [ x_start, y_start + total_height - 20 ])

    # Stamp each signer
    signed_signers.each_with_index do |signer, index|
      y = y_start + total_height - 35 - (index * block_height)
      stamp_docusign_style(document, canvas, signer, x_start, y, 200, 50)
    end
  end

  # DocuSign-style signature stamp: signature image/text + green "Signed" label + timestamp
  def stamp_docusign_style(document, canvas, signer, x, y, width, height)
    sig_data = signer.signature_data

    # Draw signature image if available
    if sig_data.present? && sig_data.start_with?("data:image")
      begin
        image_data = sig_data.split(",")[1]
        image_bytes = Base64.decode64(image_data)

        Tempfile.create([ "sig", ".png" ]) do |temp|
          temp.binmode
          temp.write(image_bytes)
          temp.rewind

          image = document.images.add(temp.path)
          canvas.image(
            image,
            at: [ x, y + 15 ],
            width: [ width, 170 ].min,
            height: [ height - 20, 35 ].min
          )
        end
      rescue StandardError => e
        Rails.logger.error("ESignaturePdfStamper: Failed to stamp legacy signature image: #{e.message}")
        # Fall back to typed name
        canvas.font("Helvetica", variant: :bold, size: 11)
        canvas.fill_color("000000")
        canvas.text(signer.name, at: [ x, y + height - 18 ])
      end
    else
      # Typed signature
      canvas.font("Helvetica", variant: :bold, size: 11)
      canvas.fill_color("000000")
      canvas.text(signer.name, at: [ x, y + height - 18 ])
    end

    # Signed by line with timestamp (DocuSign style)
    canvas.font("Helvetica", size: 7)
    canvas.fill_color("666666")
    signed_time = signer.signed_at&.strftime("%d/%m/%Y %H:%M AEST")
    canvas.text("Signed by: #{signer.name}", at: [ x, y + 8 ])
    canvas.text("Date: #{signed_time}", at: [ x, y ])
  end

  # Stamp all positioned fields onto the document
  def stamp_positioned_fields(document)
    # Group fields by page
    fields_by_page = @request.fields.completed.group_by(&:page_number)

    fields_by_page.each do |page_number, fields|
      # Pages are 0-indexed in HexaPDF
      page = document.pages[page_number - 1]
      next unless page

      box = page.box

      fields.each do |field|
        stamp_field(document, page, box, field)
      end
    end
  end

  # Stamp a single field at its positioned location
  def stamp_field(document, page, box, field)
    # Convert percentage position to PDF coordinates
    # PDF coordinates are from bottom-left, so we need to flip Y
    x = (field.x_percent / 100.0) * box.width
    y = box.height - ((field.y_percent / 100.0) * box.height)
    width = (field.width_percent / 100.0) * box.width
    height = (field.height_percent / 100.0) * box.height

    # Adjust Y to account for height (PDF draws from bottom)
    y = y - height

    case field.field_type
    when "signature", "initials"
      stamp_signature_field(document, page, field, x, y, width, height)
    when "date"
      stamp_date_field(page, field, x, y, width, height)
    when "text"
      stamp_text_field(page, field, x, y, width, height)
    end
  end

  # Stamp a signature or initials field
  def stamp_signature_field(document, page, field, x, y, width, height)
    canvas = page.canvas(type: :overlay)
    signer = field.e_signature_signer

    # Draw field border (light gray dashed)
    canvas.stroke_color("cccccc")
    canvas.line_dash_pattern([ 2, 2 ])
    canvas.rectangle(x, y, width, height)
    canvas.stroke
    canvas.line_dash_pattern(0)

    # Add signature image
    if field.value.present? && field.value.start_with?("data:image")
      begin
        # Decode base64 image
        image_data = field.value.split(",")[1]
        image_bytes = Base64.decode64(image_data)

        # Create temp file and add to PDF
        Tempfile.create([ "sig", ".png" ]) do |temp|
          temp.binmode
          temp.write(image_bytes)
          temp.rewind

          image = document.images.add(temp.path)
          # Add some padding inside the field
          padding = 2
          canvas.image(
            image,
            at: [ x + padding, y + padding ],
            width: width - (padding * 2),
            height: height - 10 # Leave room for metadata
          )
        end
      rescue StandardError => e
        Rails.logger.error("ESignaturePdfStamper: Failed to stamp signature image: #{e.message}")
        # Fall back to signer name
        stamp_fallback_text(canvas, signer.name, x, y, width, height)
      end
    else
      stamp_fallback_text(canvas, signer.name, x, y, width, height)
    end

    # Add signature metadata below the signature
    canvas.font("Helvetica", size: 5)
    canvas.fill_color("888888")
    metadata = "#{signer.name} | #{field.completed_at&.strftime('%d/%m/%Y %H:%M')}"
    canvas.text(metadata, at: [ x + 2, y + 2 ])
  end

  # Stamp a date field
  def stamp_date_field(page, field, x, y, width, height)
    canvas = page.canvas(type: :overlay)

    # Format the date value
    formatted_date = if field.value.present?
      begin
        Date.parse(field.value).strftime(field.date_format.presence || "%d/%m/%Y")
      rescue ArgumentError
        field.value
      end
    else
      ""
    end

    # Draw field border
    canvas.stroke_color("cccccc")
    canvas.line_dash_pattern([ 2, 2 ])
    canvas.rectangle(x, y, width, height)
    canvas.stroke
    canvas.line_dash_pattern(0)

    # Draw the date text
    canvas.font("Helvetica", size: [ height * 0.6, 12 ].min)
    canvas.fill_color("000000")
    # Center vertically in the field
    text_y = y + (height / 2) - 4
    canvas.text(formatted_date, at: [ x + 4, text_y ])
  end

  # Stamp a text field
  def stamp_text_field(page, field, x, y, width, height)
    canvas = page.canvas(type: :overlay)

    # Draw field border
    canvas.stroke_color("cccccc")
    canvas.line_dash_pattern([ 2, 2 ])
    canvas.rectangle(x, y, width, height)
    canvas.stroke
    canvas.line_dash_pattern(0)

    # Draw the text
    canvas.font("Helvetica", size: [ height * 0.6, 10 ].min)
    canvas.fill_color("000000")
    text_y = y + (height / 2) - 3
    canvas.text(field.value || "", at: [ x + 4, text_y ])
  end

  # Fall back to text if signature image fails
  def stamp_fallback_text(canvas, text, x, y, width, height)
    canvas.font("Helvetica", size: 12)
    canvas.fill_color("000000")
    canvas.text(text, at: [ x + 5, y + height - 15 ])
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
    canvas.font("Helvetica", variant: :bold, size: 24)
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
    canvas.font("Helvetica", variant: :bold, size: 12)
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
    canvas.font("Helvetica", variant: :bold, size: 12)
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
    canvas.font("Helvetica", variant: :bold, size: 12)
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
      "Verify this document at: https://teeem.vercel.app/verify/#{cert&.certificate_number}",
      at: [ MARGIN, y ]
    )
  end
end
