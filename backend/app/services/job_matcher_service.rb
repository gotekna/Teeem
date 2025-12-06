class JobMatcherService
  # Confidence thresholds
  AUTO_MATCH_THRESHOLD = 70.0
  SUGGEST_THRESHOLD = 50.0

  def initialize(job_name)
    @job_name = job_name.to_s.strip
  end

  def call
    return { success: false, error: "Job name cannot be empty" } if @job_name.blank?

    matches = find_matches
    best_match = matches.first

    result = {
      success: true,
      job_name_searched: @job_name,
      matches: matches
    }

    if best_match && best_match[:confidence_score] >= AUTO_MATCH_THRESHOLD
      result[:status] = :auto_matched
      result[:matched_job] = best_match
    elsif matches.any? { |m| m[:confidence_score] >= SUGGEST_THRESHOLD }
      result[:status] = :suggest_candidates
      result[:candidate_jobs] = matches.select { |m| m[:confidence_score] >= SUGGEST_THRESHOLD }
    else
      result[:status] = :no_match
    end

    result
  end

  private

  def find_matches
    constructions = Construction.all.to_a

    matches = constructions.map do |construction|
      score = calculate_similarity_score(construction.title)
      {
        id: construction.id,
        title: construction.title,
        confidence_score: score.round(2)
      }
    end

    # Sort by confidence score descending and return top 5
    matches.sort_by { |m| -m[:confidence_score] }.take(5)
  end

  def calculate_similarity_score(construction_title)
    return 0.0 if construction_title.blank?

    # Normalize both strings
    normalized_job = normalize_string(@job_name)
    normalized_title = normalize_string(construction_title)

    # Exact match
    return 100.0 if normalized_job == normalized_title

    # Calculate Levenshtein distance
    distance = levenshtein_distance(normalized_job, normalized_title)
    max_length = [ normalized_job.length, normalized_title.length ].max

    # Convert distance to similarity percentage
    similarity = (1.0 - (distance.to_f / max_length)) * 100

    # Bonus points for substring matches
    if normalized_title.include?(normalized_job) || normalized_job.include?(normalized_title)
      similarity = [ similarity + 20, 95.0 ].min
    end

    # Bonus for word matches
    job_words = normalized_job.split
    title_words = normalized_title.split
    common_words = job_words & title_words
    if common_words.any?
      word_match_bonus = (common_words.length.to_f / [ job_words.length, title_words.length ].max) * 15
      similarity = [ similarity + word_match_bonus, 99.0 ].min
    end

    [ similarity, 0.0 ].max
  end

  def normalize_string(str)
    str.to_s
       .downcase
       .gsub(/[^a-z0-9\s]/, "") # Remove special characters
       .gsub(/\s+/, " ")        # Normalize whitespace
       .strip
  end

  # Levenshtein distance algorithm (dynamic programming)
  # Calculates the minimum number of edits (insertions, deletions, substitutions) needed
  # to transform one string into another
  def levenshtein_distance(str1, str2)
    return str2.length if str1.empty?
    return str1.length if str2.empty?

    # Create a matrix to store distances
    matrix = Array.new(str1.length + 1) { Array.new(str2.length + 1) }

    # Initialize first row and column
    (0..str1.length).each { |i| matrix[i][0] = i }
    (0..str2.length).each { |j| matrix[0][j] = j }

    # Calculate distances
    (1..str1.length).each do |i|
      (1..str2.length).each do |j|
        cost = str1[i - 1] == str2[j - 1] ? 0 : 1

        matrix[i][j] = [
          matrix[i - 1][j] + 1,     # deletion
          matrix[i][j - 1] + 1,     # insertion
          matrix[i - 1][j - 1] + cost  # substitution
        ].min
      end
    end

    matrix[str1.length][str2.length]
  end
end
