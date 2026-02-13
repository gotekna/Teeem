# frozen_string_literal: true

# Lightweight controller for PDF template rendering.
#
# ApplicationController inherits from ActionController::API which does NOT
# include the rendering modules needed for templates and layouts. This
# controller inherits from ActionController::Base to provide full template
# rendering support for services like DirectorChangeService and
# Form43CertificateGenerator.
#
# Usage:
#   PdfRenderController.render(template: "path/to/template", layout: "pdf", assigns: { ... })
#
class PdfRenderController < ActionController::Base
  # No filters, no auth - this is only used server-side by services
end
