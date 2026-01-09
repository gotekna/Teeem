# frozen_string_literal: true

# Grover configuration for HTML → PDF conversion
# Used by TeknaDocumentGenerator for Tekna document templates
#
# Grover uses Puppeteer (headless Chrome) for high-quality PDF rendering.
# On Heroku, requires the puppeteer-heroku-buildpack:
#   heroku buildpacks:add --index 1 https://github.com/jontewks/puppeteer-heroku-buildpack
#
Grover.configure do |config|
  config.options = {
    format: "A4",
    margin: {
      top: "0mm",
      bottom: "0mm",
      left: "0mm",
      right: "0mm"
    },
    print_background: true,
    prefer_css_page_size: true,
    display_header_footer: false,
    # Required for Heroku/Linux environments
    launch_args: [ "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu" ]
  }

  # Use system Chrome on Heroku (installed via buildpack)
  if ENV["GOOGLE_CHROME_SHIM"].present?
    config.options[:executable_path] = ENV["GOOGLE_CHROME_SHIM"]
  end
end
