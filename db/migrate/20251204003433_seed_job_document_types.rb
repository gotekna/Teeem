class SeedJobDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Job Document Types for construction/building projects
    job_document_types = [
      {
        abbreviation: 'RVT',
        name: 'Revit Project',
        naming_format: '{JobCode} - {Description}',
        folder: 'REVIT',
        target_folder: '01 REVIT',
        file_extensions: [ '.rvt' ],
        category: 'general',
        scope: 'job',
        description: 'Revit BIM project files'
      },
      {
        abbreviation: 'RFA',
        name: 'Revit Family',
        naming_format: '{JobCode} - {Description}',
        folder: 'REVIT',
        target_folder: '01 REVIT',
        file_extensions: [ '.rfa' ],
        category: 'general',
        scope: 'job',
        description: 'Revit family files for components'
      },
      {
        abbreviation: 'DWG',
        name: 'AutoCAD Drawing',
        naming_format: '{JobCode} - {Description}',
        folder: 'CAD',
        target_folder: '02 DXF DWG',
        file_extensions: [ '.dwg' ],
        category: 'general',
        scope: 'job',
        description: 'AutoCAD drawing files'
      },
      {
        abbreviation: 'DXF',
        name: 'AutoCAD Export',
        naming_format: '{JobCode} - {Description}',
        folder: 'CAD',
        target_folder: '02 DXF DWG',
        file_extensions: [ '.dxf' ],
        category: 'general',
        scope: 'job',
        description: 'AutoCAD exchange format files'
      },
      {
        abbreviation: 'JCON',
        name: 'Job Contract',
        naming_format: '{JobCode} Contract {Date}',
        folder: 'CONTRACT',
        target_folder: '03 Contract',
        file_extensions: [ '.pdf' ],
        category: 'general',
        scope: 'job',
        description: 'Building contracts and agreements'
      },
      {
        abbreviation: 'JVAR',
        name: 'Job Variation',
        naming_format: '{JobCode} Variation {Number}',
        folder: 'CONTRACT',
        target_folder: '03 Contract',
        file_extensions: [ '.pdf' ],
        category: 'general',
        scope: 'job',
        description: 'Contract variations and amendments'
      },
      {
        abbreviation: 'HEBS',
        name: 'Energy Compliance',
        naming_format: '{JobCode} HEBS {Date}',
        folder: 'COMPLIANCE',
        target_folder: '04 HEBS',
        file_extensions: [ '.pdf' ],
        category: 'general',
        scope: 'job',
        description: 'HEBS energy compliance documentation'
      },
      {
        abbreviation: 'CERT',
        name: 'Certification',
        naming_format: '{JobCode} {CertType} {Date}',
        folder: 'COMPLIANCE',
        target_folder: '04 Certification',
        file_extensions: [ '.pdf' ],
        category: 'general',
        scope: 'job',
        description: 'Building certifications and approvals'
      },
      {
        abbreviation: 'LAND',
        name: 'Land/Survey',
        naming_format: '{JobCode} - {Description}',
        folder: 'LAND',
        target_folder: '05 Land Info',
        file_extensions: [ '.pdf', '.dwg' ],
        category: 'general',
        scope: 'job',
        description: 'Land survey and site documentation'
      },
      {
        abbreviation: 'COLOR',
        name: 'Colour Selection',
        naming_format: '{JobCode} Colour Selection',
        folder: 'DESIGN',
        target_folder: '06 Colour Selection',
        file_extensions: [ '.pdf', '.xlsx' ],
        category: 'general',
        scope: 'job',
        description: 'Client colour and finish selections'
      },
      {
        abbreviation: 'CONSUL',
        name: 'Consultant Doc',
        naming_format: '{JobCode} {Consultant} {Description}',
        folder: 'CONSULTANTS',
        target_folder: '07 Consult Docs',
        file_extensions: [ '.pdf' ],
        category: 'general',
        scope: 'job',
        description: 'Documents from external consultants'
      },
      {
        abbreviation: 'PHOTO',
        name: 'Site Photo',
        naming_format: '{JobCode} {Date} {Description}',
        folder: 'PHOTOS',
        target_folder: '08 Photos',
        file_extensions: [ '.jpg', '.jpeg', '.png', '.heic' ],
        category: 'general',
        scope: 'job',
        description: 'Site progress and inspection photos'
      }
    ]

    job_document_types.each do |attrs|
      # Use find_or_create to be idempotent
      DocumentType.find_or_create_by!(abbreviation: attrs[:abbreviation]) do |dt|
        dt.assign_attributes(attrs.except(:abbreviation))
        dt.active = true
        dt.primary_tab = attrs[:folder]
        dt.tabs = [ attrs[:folder] ]
      end
    end
  end

  def down
    DocumentType.where(scope: 'job').destroy_all
  end
end
