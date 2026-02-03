# frozen_string_literal: true

# NotebookExportService - Exports notebook pages to standalone HTML files
#
# Converts NotebookPage content (TipTap HTML + positioned boxes + strokes)
# into a complete, self-contained HTML document for File Warehouse storage.
#
# Usage:
#   service = NotebookExportService.new
#   html_content = service.export_html(notebook_page)
#
class NotebookExportService
  # Export a notebook page to a complete HTML document
  #
  # @param page [NotebookPage] The notebook page to export
  # @return [String] Complete HTML document string
  def export_html(page)
    content_metadata = page.content_metadata || {}
    positioned_boxes = content_metadata["positioned_boxes"] || content_metadata["positionedBoxes"] || []
    strokes = content_metadata["strokes"] || []

    build_html_document(
      title: page.title,
      main_content: page.content || "",
      positioned_boxes: positioned_boxes,
      strokes: strokes,
      updated_at: page.updated_at,
      notebook_name: page.notebook&.name,
      section_name: page.section&.name
    )
  end

  private

  def build_html_document(title:, main_content:, positioned_boxes:, strokes:, updated_at:, notebook_name:, section_name:)
    <<~HTML
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="generator" content="TEEEM Notebook Export">
        <meta name="exported-at" content="#{Time.current.iso8601}">
        <title>#{escape_html(title)}</title>
        <style>
          #{export_styles}
        </style>
      </head>
      <body>
        <div class="notebook-page">
          #{render_header(title, notebook_name, section_name, updated_at)}
          <div class="page-canvas">
            #{render_strokes_svg(strokes)}
            #{render_positioned_boxes(positioned_boxes, main_content)}
          </div>
        </div>
      </body>
      </html>
    HTML
  end

  def export_styles
    <<~CSS
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #1f2937;
        background: #f9fafb;
        padding: 2rem;
      }

      .notebook-page {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .page-header {
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .page-header h1 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.5rem;
      }

      .page-meta {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .page-meta span {
        margin-right: 1rem;
      }

      .page-canvas {
        position: relative;
        min-height: 600px;
        padding: 2rem;
      }

      /* Drawing strokes SVG layer */
      .strokes-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
      }

      /* Positioned boxes container */
      .positioned-box {
        position: absolute;
        padding: 0.5rem;
        z-index: 2;
      }

      .positioned-box.main-content {
        position: relative;
        width: 90%;
        margin: 0 auto;
      }

      /* TipTap content styles */
      .tiptap-content {
        line-height: 1.7;
      }

      .tiptap-content p {
        margin-bottom: 1rem;
      }

      .tiptap-content h1 {
        font-size: 2rem;
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 1rem;
      }

      .tiptap-content h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.75rem;
      }

      .tiptap-content h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
      }

      .tiptap-content ul, .tiptap-content ol {
        margin-left: 1.5rem;
        margin-bottom: 1rem;
      }

      .tiptap-content li {
        margin-bottom: 0.25rem;
      }

      .tiptap-content blockquote {
        border-left: 4px solid #e5e7eb;
        padding-left: 1rem;
        margin-left: 0;
        margin-bottom: 1rem;
        color: #6b7280;
        font-style: italic;
      }

      .tiptap-content pre {
        background: #1f2937;
        color: #f9fafb;
        padding: 1rem;
        border-radius: 6px;
        overflow-x: auto;
        margin-bottom: 1rem;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.875rem;
      }

      .tiptap-content code {
        background: #f3f4f6;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.875em;
      }

      .tiptap-content pre code {
        background: transparent;
        padding: 0;
      }

      .tiptap-content a {
        color: #2563eb;
        text-decoration: underline;
      }

      .tiptap-content img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
      }

      .tiptap-content table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
      }

      .tiptap-content th, .tiptap-content td {
        border: 1px solid #e5e7eb;
        padding: 0.5rem 0.75rem;
        text-align: left;
      }

      .tiptap-content th {
        background: #f9fafb;
        font-weight: 600;
      }

      .tiptap-content hr {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 2rem 0;
      }

      /* Image boxes */
      .positioned-image img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
      }

      /* Print styles */
      @media print {
        body {
          background: white;
          padding: 0;
        }

        .notebook-page {
          box-shadow: none;
          border-radius: 0;
        }

        .page-header {
          background: white;
        }
      }
    CSS
  end

  def render_header(title, notebook_name, section_name, updated_at)
    meta_parts = []
    meta_parts << "<span>#{escape_html(notebook_name)}</span>" if notebook_name.present?
    meta_parts << "<span>#{escape_html(section_name)}</span>" if section_name.present?
    meta_parts << "<span>Last updated: #{updated_at&.strftime('%B %d, %Y at %H:%M')}</span>" if updated_at

    <<~HTML
      <div class="page-header">
        <h1>#{escape_html(title)}</h1>
        <div class="page-meta">#{meta_parts.join(' / ')}</div>
      </div>
    HTML
  end

  def render_positioned_boxes(boxes, main_content)
    return render_main_content(main_content) if boxes.empty?

    html_parts = []

    boxes.each do |box|
      box = box.deep_stringify_keys if box.respond_to?(:deep_stringify_keys)

      if box["isMainContent"] || box["is_main_content"]
        # Main content box - use the page's main content
        html_parts << render_main_content(main_content)
      elsif box["type"] == "image" || box["imageUrl"].present? || box["image_url"].present?
        # Image box
        html_parts << render_image_box(box)
      else
        # Text box
        html_parts << render_text_box(box)
      end
    end

    # If no main content box was found in positioned boxes, add it
    unless boxes.any? { |b| b["isMainContent"] || b["is_main_content"] }
      html_parts.unshift(render_main_content(main_content))
    end

    html_parts.join("\n")
  end

  def render_main_content(content)
    <<~HTML
      <div class="positioned-box main-content">
        <div class="tiptap-content">
          #{content}
        </div>
      </div>
    HTML
  end

  def render_text_box(box)
    x = box["x_percent"] || box["xPercent"] || 5
    y = box["y_percent"] || box["yPercent"] || 5
    width = box["width_percent"] || box["widthPercent"] || 30
    content = box["content"] || ""

    <<~HTML
      <div class="positioned-box" style="left: #{x}%; top: #{y}%; width: #{width}%;">
        <div class="tiptap-content">
          #{content}
        </div>
      </div>
    HTML
  end

  def render_image_box(box)
    x = box["x_percent"] || box["xPercent"] || 5
    y = box["y_percent"] || box["yPercent"] || 5
    width = box["width_percent"] || box["widthPercent"] || 30
    image_url = box["imageUrl"] || box["image_url"] || ""

    return "" if image_url.blank?

    <<~HTML
      <div class="positioned-box positioned-image" style="left: #{x}%; top: #{y}%; width: #{width}%;">
        <img src="#{escape_html(image_url)}" alt="Embedded image" />
      </div>
    HTML
  end

  def render_strokes_svg(strokes)
    return "" if strokes.blank?

    paths = strokes.map { |stroke| render_stroke_path(stroke) }.compact.join("\n")
    return "" if paths.blank?

    <<~HTML
      <svg class="strokes-layer" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        #{paths}
      </svg>
    HTML
  end

  def render_stroke_path(stroke)
    stroke = stroke.deep_stringify_keys if stroke.respond_to?(:deep_stringify_keys)

    points = stroke["points"] || []
    return nil if points.length < 2

    color = stroke["color"] || "#000000"
    size = stroke["size"] || 2

    # Build SVG path from points
    path_data = points.each_with_index.map do |point, index|
      point = point.deep_stringify_keys if point.respond_to?(:deep_stringify_keys)
      x = point["x"] || point[0]
      y = point["y"] || point[1]

      if index == 0
        "M #{x} #{y}"
      else
        "L #{x} #{y}"
      end
    end.join(" ")

    %(<path d="#{path_data}" stroke="#{escape_html(color)}" stroke-width="#{size}" fill="none" stroke-linecap="round" stroke-linejoin="round" />)
  end

  def escape_html(text)
    return "" if text.nil?
    CGI.escapeHTML(text.to_s)
  end
end
