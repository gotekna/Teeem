# Service to detect and manage document duplicates for a case
# - Detects duplicates via content hash
# - Generates user-friendly display names
# - Generates short codes for AI reference
class CaseDocumentDuplicateService
  attr_reader :case_record, :results

  def initialize(case_record)
    @case_record = case_record
    @results = {
      documents_processed: 0,
      short_codes_generated: 0,
      duplicates_detected: 0
    }
  end

  # Main entry point - process duplicates and generate short codes
  def process
    Rails.logger.info "[CaseDocumentDuplicate] Starting for case #{case_record.id}"

    detect_duplicates
    generate_short_codes

    Rails.logger.info "[CaseDocumentDuplicate] Complete: #{@results.inspect}"
    @results
  end

  # Detect duplicates within the case
  def detect_duplicates
    # Get all case documents with their company_documents
    case_docs = case_record.case_documents.includes(:company_document)

    # Group by content hash
    hash_groups = {}
    case_docs.each do |case_doc|
      hash = case_doc.company_document&.content_hash
      next if hash.blank?

      hash_groups[hash] ||= []
      hash_groups[hash] << case_doc
    end

    # Find groups with duplicates
    hash_groups.each do |hash, docs|
      next if docs.length <= 1

      # Mark as duplicates (first one is the canonical)
      canonical = docs.first
      docs[1..-1].each do |duplicate|
        # These are duplicates within the case - user may want to remove
        Rails.logger.info "[CaseDocumentDuplicate] Found duplicate: #{duplicate.company_document.title}"
        @results[:duplicates_detected] += 1
      end
    end
  end

  # Generate short codes for all case documents and emails
  def generate_short_codes
    # Documents: DOC-001, DOC-002, etc.
    doc_sequence = 1
    case_record.case_documents.where(short_code: nil).order(:created_at).each do |case_doc|
      case_doc.update_column(:short_code, "DOC-#{doc_sequence.to_s.rjust(3, '0')}")
      doc_sequence += 1
      @results[:short_codes_generated] += 1
    end

    # Emails: EMAIL-001, EMAIL-002, etc.
    email_sequence = 1
    case_record.case_emails.where(short_code: nil).order(:created_at).each do |case_email|
      case_email.update_column(:short_code, "EMAIL-#{email_sequence.to_s.rjust(3, '0')}")
      email_sequence += 1
      @results[:short_codes_generated] += 1
    end

    @results[:documents_processed] = doc_sequence - 1 + email_sequence - 1
  end

  # Get all pending duplicate reviews for this case
  def pending_reviews
    case_record.document_duplicate_reviews.pending
  end

  # Resolve a duplicate by keeping the existing document
  def resolve_keep_existing(review_id, user)
    review = case_record.document_duplicate_reviews.find(review_id)
    review.keep_existing!(user)
  end

  # Resolve a duplicate by replacing with the new document
  def resolve_replace(review_id, user)
    review = case_record.document_duplicate_reviews.find(review_id)
    review.replace!(user)
  end

  # Resolve a duplicate by keeping both
  def resolve_keep_both(review_id, user, new_company_document)
    review = case_record.document_duplicate_reviews.find(review_id)
    review.keep_both!(user, new_company_document)
  end

  # Generate a user-friendly display name from filename
  def self.generate_display_name(filename)
    name = filename.to_s

    # Remove file extension
    name = name.sub(/\.[^.]+$/, "")

    # Replace underscores and dashes with spaces
    name = name.gsub(/[_-]/, " ")

    # Remove common prefixes (company codes, etc.)
    name = name.sub(/^[A-Z]{2,5}\s+/, "")

    # Expand common abbreviations
    expansions = {
      "CTR" => "Company Tax Return",
      "TTR" => "Trust Tax Return",
      "BAS" => "Business Activity Statement",
      "FS" => "Financial Statements",
      "FY" => "Financial Year"
    }

    expansions.each do |abbr, full|
      name = name.gsub(/\b#{abbr}\b/, full)
    end

    # Clean up extra spaces
    name = name.gsub(/\s+/, " ").strip

    # Titleize
    name.titleize
  end
end
