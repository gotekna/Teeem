# frozen_string_literal: true

# TeknaTemplateRenderer renders ERB templates with layout support for document generation.
#
# Usage:
#   renderer = TeknaTemplateRenderer.new
#   html = renderer.render(
#     template_path: "templates/welcome_letter",
#     layout: "layouts/tekna",
#     locals: { job: job_context, company: company_context, ... }
#   )
#
class TeknaTemplateRenderer
  VIEWS_PATH = Rails.root.join("app/views/tekna_documents")

  def initialize
    @partials_cache = {}
  end

  # Render a template with optional layout
  # @param template_path [String] Path to template (without .html.erb)
  # @param layout [String, nil] Path to layout (without .html.erb)
  # @param locals [Hash] Variables to make available in template
  # @return [String] Rendered HTML
  def render(template_path:, layout: nil, locals: {})
    template_content = read_template("#{template_path}.html.erb")

    # Create render context with locals and helpers
    context = RenderContext.new(locals, self)
    content = render_erb(template_content, context)

    if layout
      layout_content = read_template("#{layout}.html.erb")
      context.content = content
      content = render_erb(layout_content, context)
    end

    content
  end

  # Render a partial (called from within templates)
  # @param partial_name [String] Partial name (e.g., "header" or "partials/header")
  # @param locals [Hash] Variables to pass to partial
  # @return [String] Rendered partial HTML
  def render_partial(partial_name, locals = {}, parent_context = nil)
    # Convert partial name to path (e.g., "header" -> "partials/_header.html.erb")
    partial_path = normalize_partial_path(partial_name)

    template_content = read_template(partial_path)

    # Merge parent context locals with partial-specific locals
    merged_locals = parent_context ? parent_context.to_hash.merge(locals) : locals
    context = RenderContext.new(merged_locals, self)
    render_erb(template_content, context)
  end

  private

  def read_template(relative_path)
    full_path = VIEWS_PATH.join(relative_path)
    raise "Template not found: #{relative_path} (looked in #{full_path})" unless File.exist?(full_path)
    File.read(full_path)
  end

  def render_erb(template, context)
    ERB.new(template, trim_mode: "-").result(context.get_binding)
  end

  def normalize_partial_path(partial_name)
    # If already includes partials/, just add underscore prefix to filename
    if partial_name.include?("/")
      dir, file = partial_name.rsplit("/", 2)
      file = "_#{file}" unless file.start_with?("_")
      "#{dir}/#{file}.html.erb"
    else
      # Default to partials directory
      "partials/_#{partial_name}.html.erb"
    end
  end

  # Context class that provides helper methods and variable access in templates
  class RenderContext
    attr_accessor :content

    def initialize(locals, renderer)
      @renderer = renderer
      @locals = locals

      # Make all locals available as instance variables and methods
      locals.each do |key, value|
        instance_variable_set("@#{key}", value)
        define_singleton_method(key) { value } unless respond_to?(key)
      end
    end

    def get_binding
      binding
    end

    def to_hash
      @locals
    end

    # Render a partial from within a template
    # Usage: <%= render "header" %> or <%= render "header", title: "Custom" %>
    def render(partial_name, locals = {})
      @renderer.render_partial(partial_name, locals, self)
    end

    # Yield content (for layouts)
    def yield_content
      content
    end

    # ===== Formatting Helpers =====

    def format_currency(amount)
      return "-" if amount.nil?
      "$#{'%.2f' % amount.to_f}"
    end

    def format_currency_words(amount)
      return "" if amount.nil?
      # Simple conversion for common amounts
      dollars = amount.to_i
      cents = ((amount.to_f - dollars) * 100).round

      words = number_to_words(dollars)
      if cents > 0
        "#{words} dollars and #{cents}/100"
      else
        "#{words} dollars"
      end
    end

    def format_date(date, format = :default)
      return "-" if date.nil?
      date = Date.parse(date.to_s) if date.is_a?(String)

      case format
      when :long
        date.strftime("%d %B %Y")      # 17 December 2025
      when :short
        date.strftime("%d/%m/%Y")       # 17/12/2025
      when :month_year
        date.strftime("%B %Y")          # December 2025
      else
        date.strftime("%d %B %Y")       # Default: 17 December 2025
      end
    end

    def format_abn(abn)
      return abn unless abn.present?
      digits = abn.to_s.gsub(/\D/, "")
      return abn if digits.length != 11
      "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
    end

    def format_phone(phone)
      return phone unless phone.present?
      digits = phone.to_s.gsub(/\D/, "")
      return phone if digits.length != 10

      if digits.start_with?("04")
        "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
      else
        "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
      end
    end

    def format_address(address)
      return "" unless address.present?
      address.to_s.gsub("\n", "<br>").html_safe
    end

    # ===== Conditional Helpers =====

    def present?(value)
      value.present?
    end

    def blank?(value)
      value.blank?
    end

    # ===== CSS Helpers =====

    def design_tokens_css
      TeknaDesignTokens.document_css
    end

    def tekna_header_css
      TeknaDesignTokens.tekna_header_css
    end

    def tekna_footer_css
      TeknaDesignTokens.tekna_footer_css
    end

    def qbcc_notice_css
      TeknaDesignTokens.qbcc_notice_css
    end

    def signature_css
      TeknaDesignTokens.signature_css
    end

    # ===== Date Helpers =====

    def today
      Date.current
    end

    def current_year
      Date.current.year
    end

    private

    # Simple number to words (for contract amounts)
    def number_to_words(number)
      return "zero" if number == 0

      ones = %w[zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen]
      tens = %w[zero ten twenty thirty forty fifty sixty seventy eighty ninety]

      if number < 20
        ones[number]
      elsif number < 100
        t, o = number.divmod(10)
        o > 0 ? "#{tens[t]}-#{ones[o]}" : tens[t]
      elsif number < 1000
        h, remainder = number.divmod(100)
        remainder > 0 ? "#{ones[h]} hundred and #{number_to_words(remainder)}" : "#{ones[h]} hundred"
      elsif number < 1_000_000
        t, remainder = number.divmod(1000)
        result = "#{number_to_words(t)} thousand"
        result += " #{number_to_words(remainder)}" if remainder > 0
        result
      else
        m, remainder = number.divmod(1_000_000)
        result = "#{number_to_words(m)} million"
        result += " #{number_to_words(remainder)}" if remainder > 0
        result
      end
    end
  end
end
