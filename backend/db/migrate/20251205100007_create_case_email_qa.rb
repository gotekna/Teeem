class CreateCaseEmailQa < ActiveRecord::Migration[8.0]
  def change
    create_table :case_email_qas do |t|
      t.references :case, null: false, foreign_key: true
      t.references :case_email, foreign_key: true
      t.references :email_warehouse, foreign_key: { to_table: :email_warehouse }

      t.text :question, null: false
      t.text :answer
      t.string :question_from
      t.string :answer_from
      t.datetime :question_date
      t.datetime :answer_date

      t.boolean :is_answered, default: false
      t.boolean :is_important, default: false
      t.string :category

      t.timestamps
    end

    add_index :case_email_qas, [ :case_id, :is_answered ]
  end
end
