# frozen_string_literal: true

# =============================================================================
# CorporateDocumentScannerService - DOCUMENT SCANNER (SSoT Name)
# =============================================================================
# Purpose: Scan SharePoint for existing corporate documents and link them to companies
# This is the SSoT name for CorporateOnedriveService (legacy name)
#
# Key Methods:
#   - scan_all: Scan all corporate folders for documents
#   - scan_company: Scan a specific company's folder
#   - preview: Preview what documents would be linked
#   - link_document_to_company: Link a found document to a company
#
# Usage:
#   service = CorporateDocumentScannerService.new
#   service.scan_all
#
# Migration: This is an alias for CorporateOnedriveService
# Once all code is updated to use this name, CorporateOnedriveService can be removed
# =============================================================================
class CorporateDocumentScannerService < CorporateOnedriveService
  # Inherits all functionality from CorporateOnedriveService
  # This class exists to provide a clearer, SSoT-compliant name
end
