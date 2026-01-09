class AddLinkToNotifications < ActiveRecord::Migration[8.0]
  def change
    add_column :notifications, :link, :string

    # Backfill existing notifications with links
    reversible do |dir|
      dir.up do
        # SmTask notifications
        execute <<-SQL
          UPDATE notifications
          SET link = '/tasks?taskId=' || notifiable_id::text
          WHERE notifiable_type = 'SmTask' AND notifiable_id IS NOT NULL AND link IS NULL
        SQL

        # EmailWarehouse notifications
        execute <<-SQL
          UPDATE notifications
          SET link = '/email?id=' || notifiable_id::text
          WHERE notifiable_type = 'EmailWarehouse' AND notifiable_id IS NOT NULL AND link IS NULL
        SQL

        # EmailSnooze notifications - need to join to get the email_warehouse_id
        execute <<-SQL
          UPDATE notifications
          SET link = '/email?id=' || es.email_warehouse_id::text
          FROM email_snoozes es
          WHERE notifications.notifiable_type = 'EmailSnooze'
            AND notifications.notifiable_id = es.id
            AND notifications.link IS NULL
            AND es.email_warehouse_id IS NOT NULL
        SQL
      end
    end
  end
end
