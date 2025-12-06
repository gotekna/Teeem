# Service to extract Q&A pairs from case emails using AI
# - Analyzes email threads to find questions and answers
# - Creates CaseEmailQa entries
# - Updates case.unanswered_questions_count
class CaseQaExtractionService
  CLAUDE_MODEL = "claude-3-haiku-20240307"
  MAX_TOKENS = 2000

  attr_reader :case_record, :results

  def initialize(case_record)
    @case_record = case_record
    @results = {
      emails_processed: 0,
      questions_found: 0,
      answered: 0,
      unanswered: 0,
      errors: []
    }
  end

  # Main entry point - extract Q&A from all case emails
  def extract_all
    Rails.logger.info "[CaseQAExtraction] Starting for case #{case_record.id}"

    case_record.case_emails.includes(:email_warehouse).each do |case_email|
      process_email(case_email)
    end

    # Update unanswered count on case
    update_unanswered_count

    Rails.logger.info "[CaseQAExtraction] Complete: #{@results.inspect}"
    @results
  end

  private

  def process_email(case_email)
    email = case_email.email_warehouse
    return unless email

    @results[:emails_processed] += 1

    begin
      # Get thread context for this email
      thread_context = get_thread_context(email)

      # Extract Q&A using AI
      qa_pairs = extract_qa_with_ai(email, thread_context)

      # Save Q&A pairs
      qa_pairs.each do |qa|
        create_qa_entry(case_email, qa)
      end

      # Update email's unanswered flag
      case_email.update_unanswered_flag!

    rescue => e
      @results[:errors] << { email_id: email.id, error: e.message }
      Rails.logger.error "[CaseQAExtraction] Error processing email #{email.id}: #{e.message}"
    end
  end

  def get_thread_context(email)
    return [ email ] unless email.conversation_id.present?

    EmailWarehouse
      .where(conversation_id: email.conversation_id)
      .order(received_at: :asc)
      .limit(10)
  end

  def extract_qa_with_ai(email, thread_context)
    prompt = build_extraction_prompt(email, thread_context)

    begin
      response = call_claude_api(prompt)
      parse_qa_response(response)
    rescue => e
      Rails.logger.error "[CaseQAExtraction] AI extraction failed: #{e.message}"
      []
    end
  end

  def build_extraction_prompt(email, thread_context)
    # Build thread text
    thread_text = thread_context.map do |e|
      <<~EMAIL
        --- Email ---
        From: #{e.from_name} <#{e.from_email}>
        Date: #{e.received_at&.strftime('%Y-%m-%d %H:%M')}
        Subject: #{e.subject}

        #{e.body_text.presence || strip_html(e.body_html)}
      EMAIL
    end.join("\n\n")

    <<~PROMPT
      Analyze this email thread and extract all questions asked and whether they were answered.
      Focus on questions that require action or response from someone.

      Email Thread:
      #{thread_text}

      Extract questions and answers. Return ONLY valid JSON (no markdown):

      {
        "qa_pairs": [
          {
            "question": "The exact question or request",
            "answer": "The answer if provided in a later email, or null if unanswered",
            "question_from": "Name of person who asked",
            "answer_from": "Name of person who answered (if answered)",
            "question_date": "YYYY-MM-DD of when question was asked",
            "answer_date": "YYYY-MM-DD of when it was answered (if answered)",
            "is_answered": true/false,
            "is_important": true/false (deadlines, document requests are important),
            "category": "One of: deadline, document_request, clarification, action_item, follow_up, other"
          }
        ]
      }

      Guidelines:
      - Look for questions marked with "?"
      - Look for requests like "please provide", "we need", "can you send"
      - Deadline-related questions are important
      - Document requests are important
      - Check later emails in thread for answers
      - Return empty array if no questions found
    PROMPT
  end

  def call_claude_api(prompt)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(
      access_token: api_key,
      anthropic_version: "2023-06-01"
    )

    response = client.messages(
      parameters: {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [ { role: "user", content: prompt } ]
      }
    )

    response.dig("content", 0, "text") || ""
  end

  def parse_qa_response(response_text)
    # Extract JSON from response
    json_match = response_text.match(/\{.*\}/m)
    return [] unless json_match

    data = JSON.parse(json_match[0])
    data["qa_pairs"] || []
  rescue JSON::ParserError => e
    Rails.logger.error "[CaseQAExtraction] JSON parse error: #{e.message}"
    []
  end

  def create_qa_entry(case_email, qa_data)
    # Check if this Q&A already exists (avoid duplicates)
    existing = CaseEmailQa.find_by(
      case_id: case_record.id,
      question: qa_data["question"]
    )
    return if existing

    CaseEmailQa.create!(
      case: case_record,
      case_email: case_email,
      email_warehouse: case_email.email_warehouse,
      question: qa_data["question"],
      answer: qa_data["answer"],
      question_from: qa_data["question_from"],
      answer_from: qa_data["answer_from"],
      question_date: parse_date(qa_data["question_date"]),
      answer_date: parse_date(qa_data["answer_date"]),
      is_answered: qa_data["is_answered"] || false,
      is_important: qa_data["is_important"] || false,
      category: qa_data["category"]
    )

    @results[:questions_found] += 1
    if qa_data["is_answered"]
      @results[:answered] += 1
    else
      @results[:unanswered] += 1
    end
  end

  def update_unanswered_count
    count = case_record.case_email_qas.unanswered.count
    case_record.update_column(:unanswered_questions_count, count)
  end

  def parse_date(date_string)
    return nil if date_string.blank?
    Date.parse(date_string)
  rescue ArgumentError
    nil
  end

  def strip_html(html)
    return nil if html.blank?
    html.gsub(/<[^>]*>/, " ").gsub(/\s+/, " ").strip
  end
end
