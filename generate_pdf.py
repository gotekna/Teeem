#!/usr/bin/env python3
"""Generate PDF from markdown files using markdown_pdf"""

from markdown_pdf import MarkdownPdf, Section

# Generate Executive Summary PDF
pdf = MarkdownPdf()
pdf.add_section(Section("TRAPID_EXECUTIVE_SUMMARY.md"))
pdf.save("TRAPID_EXECUTIVE_SUMMARY.pdf")
print("✓ Generated TRAPID_EXECUTIVE_SUMMARY.pdf")

# Generate Full Sales Document PDF
pdf2 = MarkdownPdf()
pdf2.add_section(Section("TRAPID_SALES_DOCUMENT.md"))
pdf2.save("TRAPID_SALES_DOCUMENT.pdf")
print("✓ Generated TRAPID_SALES_DOCUMENT.pdf")

# Generate Marketing Brochure PDF
pdf3 = MarkdownPdf()
pdf3.add_section(Section("TRAPID_MARKETING_BROCHURE.md"))
pdf3.save("TRAPID_MARKETING_BROCHURE.pdf")
print("✓ Generated TRAPID_MARKETING_BROCHURE.pdf")

# Generate Features List PDF
pdf4 = MarkdownPdf()
pdf4.add_section(Section("TRAPID_FEATURES_LIST.md"))
pdf4.save("TRAPID_FEATURES_LIST.pdf")
print("✓ Generated TRAPID_FEATURES_LIST.pdf")

print("\nAll PDFs generated successfully!")
