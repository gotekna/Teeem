namespace :documents do
  desc "Split document 840 into BAS and Income Tax statements"
  task split_840: :environment do
    doc = CompanyDocument.find(840)
    puts "Splitting document 840: #{doc.file_name}"

    doc.update!(ai_contains_multiple_documents: true)

    service = DocumentSplitService.new(doc)

    splits = [
      {
        pages: "1-2",
        title: "TD ATO Activity Statement FY24.pdf",
        document_type: "ATO BAS Statement",
        folder: "ATO"
      },
      {
        pages: "3",
        title: "TD ATO Income Tax Statement FY24.pdf",
        document_type: "ATO Income Tax Statement",
        folder: "ATO"
      }
    ]

    result = service.split!(splits)

    if result[:success]
      puts "SUCCESS! Created #{result[:documents].length} documents:"
      result[:documents].each do |new_doc|
        puts "  - ID #{new_doc.id}: #{new_doc.title}"
      end
    else
      puts "FAILED: #{result[:error]}"
    end
  end
end
