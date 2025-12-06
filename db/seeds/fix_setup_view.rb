view = TableView.find_by(name: 'Setup', table_id: 204)
if view
  puts "View ID: #{view.id}"

  cols = view.columns
  if cols.is_a?(Hash) && cols['visible'].is_a?(Hash)
    puts "Before visible: #{cols['visible'].keys.join(', ')}"

    # Remove ted_number from visible
    cols['visible'].delete('ted_number')

    # Remove ted_number from order if present
    if cols['order'].is_a?(Array)
      cols['order'] = cols['order'] - [ 'ted_number' ]
    end

    view.update!(columns: cols)
    puts "After visible: #{view.reload.columns['visible'].keys.join(', ')}"
    puts "Removed ted_number from Setup view"
  end
end
