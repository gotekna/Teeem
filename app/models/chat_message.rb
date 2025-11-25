class ChatMessage < ApplicationRecord
  belongs_to :user
  belongs_to :project, optional: true
  belongs_to :recipient_user, class_name: 'User', optional: true
  belongs_to :job, optional: true

  validates :content, presence: true

  scope :in_channel, ->(channel) { where(channel: channel).order(created_at: :asc) }
  scope :for_project, ->(project_id) { where(project_id: project_id).order(created_at: :asc) }
  scope :general, -> { where(channel: 'general', project_id: nil, recipient_user_id: nil).order(created_at: :asc) }
  scope :recent, ->(limit = 100) { order(created_at: :desc).limit(limit).reverse }
  scope :between_users, ->(user1_id, user2_id) {
    where(
      '(user_id = ? AND recipient_user_id = ?) OR (user_id = ? AND recipient_user_id = ?)',
      user1_id, user2_id, user2_id, user1_id
    ).order(created_at: :asc)
  }

  def as_json(options = {})
    super(options.merge(
      include: {
        user: { only: [:id, :email, :name] },
        job: { only: [:id, :title] }
      },
      methods: [:formatted_timestamp]
    ))
  end

  def formatted_timestamp
    if created_at.today?
      created_at.strftime('%I:%M %p')
    elsif created_at.year == Time.current.year
      created_at.strftime('%b %d at %I:%M %p')
    else
      created_at.strftime('%b %d, %Y at %I:%M %p')
    end
  end
end
