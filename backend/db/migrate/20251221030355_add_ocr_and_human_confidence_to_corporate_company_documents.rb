class AddOcrAndHumanConfidenceToCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # OCR confidence: 0-100% - how well text was extracted from PDF
    # ocr_method: 'text_extraction' (native PDF text) or 'vision' (Claude Vision OCR)
    add_column :corporate_documents, :ocr_confidence, :decimal, precision: 5, scale: 2
    add_column :corporate_documents, :ocr_method, :string

    # Human confidence: 0-100% - human validation score (set when user validates)
    add_column :corporate_documents, :human_confidence, :decimal, precision: 5, scale: 2
  end
end
