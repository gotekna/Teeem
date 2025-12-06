require 'rails_helper'

RSpec.describe "Api::V1::Columns", type: :request do
  let!(:table) { Table.create!(name: "Test Table", slug: "test_table") }
  let!(:choice_column) do
    col = table.columns.create!(
      name: "Status",
      column_name: "status",
      column_type: "choice",
      available_choices: [ "Open", "Closed", "Pending" ]
    )
    # Create the database table with the new column
    builder = TableBuilder.new(table.reload)
    builder.create_database_table
    # Reload dynamic model to pick up the new column
    table.reload_dynamic_model
    col
  end

  describe "Choice Management" do
    describe "POST /api/v1/tables/:table_id/columns/:id/rename_choice" do
      context "with available_choices metadata" do
        it "updates both data and available_choices array" do
          # Create records with the old choice value
          model = table.dynamic_model
          model.create!(status: "Open")
          model.create!(status: "Closed")

          # Rename "Open" to "In Progress"
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/rename_choice",
               params: { old_value: "Open", new_value: "In Progress" }

          expect(response).to have_http_status(:success)
          json = JSON.parse(response.body)
          expect(json["success"]).to eq(true)
          expect(json["affected_rows"]).to eq(1)

          # Verify data was updated
          expect(model.where(status: "Open").count).to eq(0)
          expect(model.where(status: "In Progress").count).to eq(1)

          # Verify available_choices was updated
          choice_column.reload
          expect(choice_column.available_choices).to include("In Progress")
          expect(choice_column.available_choices).not_to include("Open")
          expect(choice_column.available_choices).to include("Closed", "Pending")
        end

        it "does not create duplicate choices" do
          # This is the bug we're fixing
          model = table.dynamic_model
          model.create!(status: "Open")

          # Rename "Open" to "Pending" (which already exists)
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/rename_choice",
               params: { old_value: "Open", new_value: "Pending" }

          expect(response).to have_http_status(:success)

          # Verify only one "Pending" exists in available_choices
          choice_column.reload
          pending_count = choice_column.available_choices.count("Pending")
          expect(pending_count).to eq(1)
          expect(choice_column.available_choices).not_to include("Open")
        end
      end

      context "without available_choices metadata" do
        it "still updates data rows successfully" do
          # Add a column without available_choices
          minimal_column = table.columns.create!(
            name: "Category",
            column_name: "category",
            column_type: "choice"
          )
          # Rebuild table and reload model
          builder = TableBuilder.new(table.reload)
          builder.create_database_table
          table.reload_dynamic_model

          model = table.dynamic_model
          model.create!(category: "TypeA")

          post "/api/v1/tables/#{table.id}/columns/#{minimal_column.id}/rename_choice",
               params: { old_value: "TypeA", new_value: "TypeB" }

          expect(response).to have_http_status(:success)
          expect(model.where(category: "TypeB").count).to eq(1)
        end
      end

      context "validation" do
        it "requires old_value" do
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/rename_choice",
               params: { new_value: "Something" }

          expect(response).to have_http_status(:bad_request)
          json = JSON.parse(response.body)
          expect(json["error"]).to include("old_value")
        end

        it "requires new_value" do
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/rename_choice",
               params: { old_value: "Open" }

          expect(response).to have_http_status(:bad_request)
          json = JSON.parse(response.body)
          expect(json["error"]).to include("new_value")
        end
      end
    end

    describe "POST /api/v1/tables/:table_id/columns/:id/merge_choices" do
      it "merges multiple choices and updates available_choices" do
        # Create records with different choice values
        model = table.dynamic_model
        model.create!(status: "Open")
        model.create!(status: "Pending")
        model.create!(status: "Closed")

        # Merge "Open" and "Pending" into "Active"
        post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/merge_choices",
             params: {
               source_values: [ "Open", "Pending" ],
               target_value: "Active"
             }

        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)
        expect(json["affected_rows"]).to eq(2)

        # Verify data was merged
        expect(model.where(status: "Active").count).to eq(2)
        expect(model.where(status: "Open").count).to eq(0)
        expect(model.where(status: "Pending").count).to eq(0)

        # Verify available_choices was updated
        choice_column.reload
        expect(choice_column.available_choices).to include("Active")
        expect(choice_column.available_choices).not_to include("Open")
        expect(choice_column.available_choices).not_to include("Pending")
        expect(choice_column.available_choices).to include("Closed")
      end

      it "does not create duplicate target in available_choices" do
        model = table.dynamic_model
        model.create!(status: "Pending")

        # Merge "Pending" into "Closed" (which already exists)
        post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/merge_choices",
             params: {
               source_values: [ "Pending" ],
               target_value: "Closed"
             }

        expect(response).to have_http_status(:success)

        # Verify only one "Closed" in available_choices
        choice_column.reload
        closed_count = choice_column.available_choices.count("Closed")
        expect(closed_count).to eq(1)
      end

      context "validation" do
        it "requires source_values" do
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/merge_choices",
               params: { target_value: "Active" }

          expect(response).to have_http_status(:bad_request)
        end

        it "requires target_value" do
          post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/merge_choices",
               params: { source_values: [ "Open" ] }

          expect(response).to have_http_status(:bad_request)
        end
      end
    end

    describe "DELETE /api/v1/tables/:table_id/columns/:id/delete_choice" do
      it "removes choice from available_choices" do
        model = table.dynamic_model
        model.create!(status: "Closed")

        delete "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/delete_choice",
               params: { value: "Open" }

        expect(response).to have_http_status(:success)

        # Verify it was removed from available_choices
        choice_column.reload
        expect(choice_column.available_choices).not_to include("Open")
        expect(choice_column.available_choices).to include("Closed", "Pending")
      end

      it "clears data when no replacement provided" do
        model = table.dynamic_model
        record = model.create!(status: "Open")

        delete "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/delete_choice",
               params: { value: "Open" }

        expect(response).to have_http_status(:success)

        record.reload
        expect(record.status).to be_nil
      end

      it "replaces data when replacement_value provided" do
        model = table.dynamic_model
        record = model.create!(status: "Open")

        delete "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/delete_choice",
               params: { value: "Open", replacement_value: "Closed" }

        expect(response).to have_http_status(:success)

        record.reload
        expect(record.status).to eq("Closed")
      end
    end

    describe "POST /api/v1/tables/:table_id/columns/:id/add_choice" do
      it "adds choice to available_choices array" do
        post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/add_choice",
             params: { value: "Archived" }

        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)

        choice_column.reload
        expect(choice_column.available_choices).to include("Archived")
      end

      it "rejects duplicate choices" do
        post "/api/v1/tables/#{table.id}/columns/#{choice_column.id}/add_choice",
             params: { value: "Open" }

        expect(response).to have_http_status(:bad_request)
        json = JSON.parse(response.body)
        expect(json["error"]).to include("already exists")
      end
    end
  end
end
