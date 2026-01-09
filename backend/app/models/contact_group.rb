class ContactGroup < ApplicationRecord
  has_many :contact_group_memberships, dependent: :destroy
  has_many :contacts, through: :contact_group_memberships

  validates :xero_contact_group_id, presence: true, uniqueness: true
  validates :name, presence: true

  scope :active, -> { where(status: "ACTIVE") }
  scope :deleted, -> { where(status: "DELETED") }
end
