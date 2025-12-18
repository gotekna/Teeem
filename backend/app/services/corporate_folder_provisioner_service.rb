# frozen_string_literal: true

# =============================================================================
# CorporateFolderProvisionerService - FOLDER PROVISIONER (SSoT Name)
# =============================================================================
# Purpose: Create and manage folder structures for companies in SharePoint
# This is the SSoT name for CorporateOneDriveService (legacy name)
#
# Key Methods:
#   - create_company_folders: Create standard folder structure for a company
#   - create_group_folders: Create folders for a corporate group
#   - create_or_find_folder: Create folder if not exists
#   - organise_company_documents: Move/rename documents to proper locations
#
# Usage:
#   service = CorporateFolderProvisionerService.new
#   service.create_company_folders(company)
#
# Migration: This is an alias for CorporateOneDriveService
# Once all code is updated to use this name, CorporateOneDriveService can be removed
# =============================================================================
class CorporateFolderProvisionerService < CorporateOneDriveService
  # Inherits all functionality from CorporateOneDriveService
  # This class exists to provide a clearer, SSoT-compliant name
end
