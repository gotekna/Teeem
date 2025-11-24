import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FileUploader from '../components/imports/FileUploader'
import ImportPreview from '../components/imports/ImportPreview'

export default function ImportPage() {
  const [step, setStep] = useState('upload') // 'upload' or 'preview'
  const [previewData, setPreviewData] = useState(null)
  const navigate = useNavigate()

  const handleFileUploaded = (data) => {
    setPreviewData(data)
    setStep('preview')
  }

  const handleImportComplete = (tableId) => {
    // Navigate directly to the table view for editing
    navigate(`/tables/${tableId}`)
  }

  const handleBack = () => {
    setStep('upload')
    setPreviewData(null)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Import Data</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload a CSV or Excel file to automatically create a new table.
        </p>
      </div>

      {step === 'upload' && (
        <FileUploader onUploadSuccess={handleFileUploaded} />
      )}

      {step === 'preview' && previewData && (
        <ImportPreview
          data={previewData}
          onComplete={handleImportComplete}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
