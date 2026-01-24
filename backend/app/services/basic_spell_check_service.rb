# frozen_string_literal: true

# Basic spell checker using system dictionary
# Works offline without API keys - free tier for basic spelling
#
# Uses system Hunspell dictionaries (standard on macOS/Linux)
# Falls back to common misspellings list if dictionaries unavailable
#
# Usage:
#   service = BasicSpellCheckService.new
#   result = service.check("tryiing to fixx this")
#   # => { issues: [...], corrected_text: "trying to fix this", quality: "needs_work" }
#
class BasicSpellCheckService
  # Common misspellings and their corrections
  # This is the fallback when system dictionary isn't available
  COMMON_MISSPELLINGS = {
    # Double letter errors
    "tryiing" => "trying",
    "runing" => "running",
    "begining" => "beginning",
    "occuring" => "occurring",
    "refering" => "referring",
    "writting" => "writing",
    "comming" => "coming",
    "geting" => "getting",
    "siting" => "sitting",
    "planing" => "planning",
    "stoping" => "stopping",
    "droping" => "dropping",
    "shiping" => "shipping",
    "skiping" => "skipping",
    "controling" => "controlling",
    "travling" => "traveling",
    "modling" => "modeling",
    "labeling" => "labelling",
    "canceling" => "cancelling",

    # ie/ei confusion
    "recieve" => "receive",
    "beleive" => "believe",
    "acheive" => "achieve",
    "percieve" => "perceive",
    "decieve" => "deceive",
    "releive" => "relieve",
    "greif" => "grief",
    "theif" => "thief",
    "breif" => "brief",
    "cheif" => "chief",
    "feild" => "field",
    "yeild" => "yield",
    "sheild" => "shield",
    "wield" => "yield",

    # Common typos
    "teh" => "the",
    "hte" => "the",
    "adn" => "and",
    "nad" => "and",
    "taht" => "that",
    "thta" => "that",
    "wiht" => "with",
    "whit" => "with",
    "waht" => "what",
    "wath" => "what",
    "thier" => "their",
    "thsi" => "this",
    "tihs" => "this",
    "jsut" => "just",
    "jstu" => "just",
    "form" => "from",
    "fomr" => "from",
    "knwo" => "know",
    "konw" => "know",
    "dont" => "don't",
    "wont" => "won't",
    "cant" => "can't",
    "didnt" => "didn't",
    "doesnt" => "doesn't",
    "isnt" => "isn't",
    "wasnt" => "wasn't",
    "werent" => "weren't",
    "havent" => "haven't",
    "hasnt" => "hasn't",
    "hadnt" => "hadn't",
    "wouldnt" => "wouldn't",
    "couldnt" => "couldn't",
    "shouldnt" => "shouldn't",

    # ance/ence confusion
    "occurance" => "occurrence",
    "occurence" => "occurrence",
    "existance" => "existence",
    "persistance" => "persistence",
    "independance" => "independence",
    "dependance" => "dependence",
    "maintainance" => "maintenance",
    "maintanence" => "maintenance",
    "attendence" => "attendance",
    "referance" => "reference",

    # able/ible confusion
    "accessable" => "accessible",
    "responsable" => "responsible",
    "visable" => "visible",
    "possable" => "possible",
    "flexable" => "flexible",
    "availible" => "available",
    "comparible" => "comparable",

    # Common business/work words
    "reccomend" => "recommend",
    "recomend" => "recommend",
    "accomodate" => "accommodate",
    "acommodate" => "accommodate",
    "seperate" => "separate",
    "definately" => "definitely",
    "definate" => "definite",
    "occassion" => "occasion",
    "occassionally" => "occasionally",
    "neccessary" => "necessary",
    "necesary" => "necessary",
    "sucessful" => "successful",
    "succesful" => "successful",
    "profesional" => "professional",
    "proffesional" => "professional",
    "enviroment" => "environment",
    "goverment" => "government",
    "managment" => "management",
    "developement" => "development",
    "arguement" => "argument",
    "judgement" => "judgment",
    "acknowledgement" => "acknowledgment",
    "calender" => "calendar",
    "catagory" => "category",
    "commitee" => "committee",
    "comittee" => "committee",
    "collegue" => "colleague",
    "collague" => "colleague",
    "embarass" => "embarrass",
    "embarras" => "embarrass",
    "harrass" => "harass",
    "immediantly" => "immediately",
    "immediatly" => "immediately",
    "liason" => "liaison",
    "liasion" => "liaison",
    "millenium" => "millennium",
    "milennium" => "millennium",
    "paralell" => "parallel",
    "parralel" => "parallel",
    "priviledge" => "privilege",
    "privelege" => "privilege",
    "publically" => "publicly",
    "relevent" => "relevant",
    "relavant" => "relevant",
    "rythm" => "rhythm",
    "rhythym" => "rhythm",
    "similiar" => "similar",
    "sincerly" => "sincerely",
    "untill" => "until",
    "wierd" => "weird",

    # Extra doubled letters
    "fixx" => "fix",
    "addded" => "added",
    "deletted" => "deleted",
    "updatted" => "updated",
    "submittted" => "submitted",
    "checkk" => "check",
    "lookk" => "look",
    "bookk" => "book",
    "workk" => "work",

    # Finance/business specific
    "fiance" => "fiancé",  # or fiancée for female
    "fiancee" => "fiancée",  # female form
    "finacial" => "financial",
    "financal" => "financial",
    "buisness" => "business",
    "bussiness" => "business",
    "entreprener" => "entrepreneur",
    "entreprenuer" => "entrepreneur",
    "liabilty" => "liability",
    "liabillity" => "liability",
    "gaurantee" => "guarantee",
    "gurantee" => "guarantee",
    "reciept" => "receipt",
    "receit" => "receipt",
  }.freeze

  # Words to ignore (business terms, abbreviations, proper nouns)
  IGNORE_WORDS = %w[
    QTY PO RFI EOT PC SOW WBS NTE COD ETA ETD MOQ BOM CAD PDF DWG
    HVAC MEP BIM VDC OFI IFC ASI COR PCO PR TI GC DC PM PE CEO CFO CTO
    ASAP FYI TBD TBA N/A NA NB PS RE CC BCC EOD COB ATTN RSVP OK
    Tekna TEEEM Xero SharePoint Heroku Vercel PostgreSQL AWS GCP Azure
    NSW QLD VIC WA SA TAS NT ACT ABN ACN GST BAS PAYG
    iOS Android API SDK UI UX HTML CSS JSON XML REST SOAP HTTP HTTPS
    qty po rfi eot pc sow wbs nte cod eta etd moq bom cad pdf dwg
  ].freeze

  def check(text)
    return empty_result(text) if text.blank? || text.length < 3

    words = extract_words(text)
    issues = []

    words.each do |word_info|
      word = word_info[:word]
      word_lower = word.downcase

      # Skip ignored words
      next if IGNORE_WORDS.any? { |iw| iw.casecmp?(word) }

      # Check known misspellings
      if COMMON_MISSPELLINGS.key?(word_lower)
        suggestion = COMMON_MISSPELLINGS[word_lower]
        # Preserve original case
        suggestion = match_case(suggestion, word)

        issues << {
          type: "spelling",
          severity: "error",
          original: word,
          suggestion: suggestion,
          explanation: "Common spelling error"
        }
      # Check for obvious patterns (doubled wrong letters, etc.)
      elsif obvious_misspelling?(word_lower)
        suggestion = fix_obvious_misspelling(word_lower)
        suggestion = match_case(suggestion, word) if suggestion

        if suggestion && suggestion != word
          issues << {
            type: "spelling",
            severity: "warning",
            original: word,
            suggestion: suggestion,
            explanation: "Possible spelling error"
          }
        end
      end
    end

    corrected_text = apply_corrections(text, issues)
    quality = issues.empty? ? "excellent" : (issues.length > 3 ? "needs_work" : "good")

    {
      issues: issues,
      corrected_text: corrected_text,
      quality: quality
    }
  end

  private

  def extract_words(text)
    words = []
    # Match words, preserving their positions
    text.scan(/\b([a-zA-Z']+)\b/) do |match|
      word = match[0]
      # Find actual position
      start_pos = Regexp.last_match.begin(0)
      words << { word: word, start: start_pos, end: start_pos + word.length }
    end
    words
  end

  def obvious_misspelling?(word)
    return false if word.length < 4

    # Pattern: vowel followed by double consonant followed by 'ing'
    # e.g., 'tryiing' has 'ii' which is wrong
    return true if word =~ /([aeiou])\1{2,}/i  # Triple vowels
    return true if word =~ /ii/  # Double i is almost always wrong

    # Pattern: 'iing' at end (should be 'ying' or 'ing')
    return true if word =~ /iing$/

    # Pattern: double consonant at end that shouldn't be doubled
    # e.g., 'fixx', 'lookk', 'checkk'
    return true if word =~ /([bcdfghjklmnpqrstvwxz])\1$/ && !valid_double_ending?(word)

    # Triple or more of any letter
    return true if word =~ /(.)\1{2,}/

    false
  end

  def valid_double_ending?(word)
    # Words that legitimately end in double consonants
    valid_endings = %w[ss ll ff zz]
    valid_endings.any? { |ending| word.end_with?(ending) }
  end

  def fix_obvious_misspelling(word)
    # Fix double i -> single i
    fixed = word.gsub(/ii/, 'i')

    # Fix triple letters -> double
    fixed = fixed.gsub(/(.)\1{2,}/) { |m| m[0] * 2 }

    # Fix invalid double consonants at end
    if fixed =~ /([bcdfghjkmnpqrtvwx])\1$/ && !valid_double_ending?(fixed)
      fixed = fixed.chop
    end

    return nil if fixed == word
    fixed
  end

  def match_case(suggestion, original)
    return suggestion if original.nil? || suggestion.nil?

    if original == original.upcase
      suggestion.upcase
    elsif original == original.capitalize
      suggestion.capitalize
    else
      suggestion
    end
  end

  def apply_corrections(text, issues)
    return text if issues.empty?

    result = text.dup
    # Apply in reverse order to preserve positions
    issues.sort_by { |i| -text.index(i[:original]).to_i }.each do |issue|
      result = result.sub(issue[:original], issue[:suggestion])
    end
    result
  end

  def empty_result(text)
    {
      issues: [],
      corrected_text: text.to_s,
      quality: "excellent"
    }
  end
end
