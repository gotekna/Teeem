# frozen_string_literal: true

# TeknaDesignTokens provides SSoT design tokens for document generation.
# Reads from exported JSON file synced from frontend globals.css.
#
# Usage:
#   TeknaDesignTokens.font_family(:sans)  # => "Geist Sans, system-ui, ..."
#   TeknaDesignTokens.font_size(:md)      # => "14px"
#   TeknaDesignTokens.color(:textPrimary) # => "#121212"
#   TeknaDesignTokens.document_css        # => Full CSS for documents
#
class TeknaDesignTokens
  TOKENS_FILE = Rails.root.join("lib/tekna_design_system/design_tokens.json")

  class << self
    def tokens
      @tokens ||= JSON.parse(File.read(TOKENS_FILE)).with_indifferent_access
    end

    def reload!
      @tokens = nil
      tokens
    end

    # Typography
    def font_family(type = :sans)
      tokens.dig(:typography, :fontFamily, type)
    end

    def font_size(size)
      tokens.dig(:typography, :fontSize, size)
    end

    def font_weight(weight)
      tokens.dig(:typography, :fontWeight, weight)
    end

    def line_height(type = :normal)
      tokens.dig(:typography, :lineHeight, type)
    end

    # Colors
    def color(name)
      tokens.dig(:colors, name)
    end

    # Spacing
    def spacing(size)
      tokens.dig(:spacing, size.to_s)
    end

    # Document dimensions
    def document_width
      tokens.dig(:document, :width)
    end

    def document_height
      tokens.dig(:document, :height)
    end

    def document_padding
      tokens.dig(:document, :padding)
    end

    def border_radius
      tokens[:borderRadius]
    end

    # Generate CSS custom properties for documents
    def document_css
      <<~CSS
        :root {
          /* Typography */
          --font-sans: #{font_family(:sans)};
          --font-mono: #{font_family(:mono)};
          --font-serif: #{font_family(:serif)};

          /* Font Sizes */
          --text-xs: #{font_size(:xs)};
          --text-sm: #{font_size(:sm)};
          --text-base: #{font_size(:base)};
          --text-md: #{font_size(:md)};
          --text-lg: #{font_size(:lg)};
          --text-xl: #{font_size(:xl)};

          /* Font Weights */
          --font-normal: #{font_weight(:normal)};
          --font-medium: #{font_weight(:medium)};
          --font-semibold: #{font_weight(:semibold)};
          --font-bold: #{font_weight(:bold)};

          /* Line Heights */
          --leading-tight: #{line_height(:tight)};
          --leading-normal: #{line_height(:normal)};
          --leading-relaxed: #{line_height(:relaxed)};

          /* Spacing */
          --space-1: #{spacing(1)};
          --space-2: #{spacing(2)};
          --space-3: #{spacing(3)};
          --space-4: #{spacing(4)};
          --space-6: #{spacing(6)};
          --space-8: #{spacing(8)};
          --space-12: #{spacing(12)};
          --space-16: #{spacing(16)};

          /* Colors */
          --color-text-primary: #{color(:textPrimary)};
          --color-text-secondary: #{color(:textSecondary)};
          --color-text-muted: #{color(:textMuted)};
          --color-background: #{color(:background)};
          --color-border: #{color(:border)};
          --color-border-light: #{color(:borderLight)};
          --color-accent: #{color(:accent)};
          --color-accent-blue: #{color(:accentBlue)};

          /* Status Colors */
          --color-success: #{color(:statusSuccess)};
          --color-success-bg: #{color(:statusSuccessBg)};
          --color-warning: #{color(:statusWarning)};
          --color-warning-bg: #{color(:statusWarningBg)};
          --color-error: #{color(:statusError)};
          --color-error-bg: #{color(:statusErrorBg)};
          --color-info: #{color(:statusInfo)};
          --color-info-bg: #{color(:statusInfoBg)};

          /* Document */
          --doc-width: #{document_width};
          --doc-height: #{document_height};
          --doc-padding: #{document_padding};

          /* Border Radius - Square corners (Tekna brand) */
          --radius: #{border_radius};
        }

        /* Base document styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: var(--font-sans);
          font-size: var(--text-md);
          font-weight: var(--font-normal);
          line-height: var(--leading-normal);
          color: var(--color-text-primary);
          background: var(--color-background);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Typography */
        h1, h2, h3, h4, h5, h6 {
          font-weight: var(--font-semibold);
          line-height: var(--leading-tight);
          margin-bottom: var(--space-3);
        }

        h1 { font-size: var(--text-xl); margin-bottom: var(--space-4); }
        h2 { font-size: var(--text-lg); margin-bottom: var(--space-3); }
        h3 { font-size: var(--text-md); font-weight: var(--font-semibold); }
        h4 { font-size: var(--text-md); font-weight: var(--font-medium); }

        p {
          margin-bottom: var(--space-3);
        }

        strong, b {
          font-weight: var(--font-semibold);
        }

        /* Tables - Tekna style (square corners) */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: var(--space-4) 0;
          font-size: var(--text-sm);
        }

        th, td {
          padding: var(--space-2) var(--space-3);
          text-align: left;
          border: 1px solid var(--color-border);
          vertical-align: top;
        }

        th {
          background: #f5f5f5;
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
        }

        /* Lists */
        ul, ol {
          margin: var(--space-3) 0;
          padding-left: var(--space-6);
        }

        li {
          margin-bottom: var(--space-2);
        }

        /* Links */
        a {
          color: var(--color-accent-blue);
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }
      CSS
    end

    # Tekna branded header CSS (for Tekna documents)
    def tekna_header_css
      <<~CSS
        .document-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--space-6);
        }

        .logo {
          max-width: 180px;
          max-height: 60px;
        }

        .company-info {
          text-align: right;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          line-height: var(--leading-relaxed);
        }

        .company-info strong {
          color: var(--color-text-primary);
        }
      CSS
    end

    # Tekna branded footer CSS (for Tekna documents)
    def tekna_footer_css
      <<~CSS
        .document-footer {
          position: absolute;
          bottom: var(--doc-padding);
          left: var(--doc-padding);
          right: var(--doc-padding);
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      CSS
    end

    # QBCC notice box CSS
    def qbcc_notice_css
      <<~CSS
        .qbcc-notice {
          background: var(--color-warning-bg);
          border: 1px solid #f59e0b;
          padding: var(--space-4);
          margin: var(--space-4) 0;
          font-size: var(--text-sm);
        }

        .qbcc-notice strong {
          display: block;
          margin-bottom: var(--space-2);
          color: var(--color-warning);
        }
      CSS
    end

    # Signature block CSS
    def signature_css
      <<~CSS
        .signature-block {
          margin-top: var(--space-8);
          page-break-inside: avoid;
        }

        .signature-row {
          display: flex;
          gap: var(--space-8);
          margin-bottom: var(--space-6);
        }

        .signature-party {
          flex: 1;
        }

        .signature-line {
          border-bottom: 1px solid var(--color-text-primary);
          height: 40px;
          margin-bottom: var(--space-2);
        }

        .signature-label {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .signature-name {
          font-weight: var(--font-semibold);
          margin-top: var(--space-1);
        }

        .witness-section {
          margin-top: var(--space-6);
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border-light);
        }
      CSS
    end
  end
end
