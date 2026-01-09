# frozen_string_literal: true

module Gl
  # TPAR payee record
  class TparPayee < ApplicationRecord
    self.table_name = "gl_tpar_payees"

    belongs_to :tpar_report, class_name: "Gl::TparReport"
    belongs_to :contact

    validates :gross_paid, presence: true

    # Net amount (gross - GST)
    def net_paid
      gross_paid - gst_paid
    end

    # Format for ATO submission
    def to_ato_format
      {
        abn: abn&.gsub(/\s/, ""),
        payee_name: payee_name,
        address: {
          line1: address_line1,
          line2: address_line2,
          suburb: suburb,
          state: state,
          postcode: postcode
        },
        gross_payment: gross_paid.to_f,
        gst: gst_paid.to_f,
        tax_withheld: tax_withheld.to_f,
        no_abn_quoted: no_abn_quoted
      }
    end
  end
end
