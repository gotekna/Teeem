web: cd backend && bundle exec puma -C config/puma.rb
worker: cd backend && bundle exec rails solid_queue:start
release: cd backend && bundle exec rails db:migrate && bundle exec rails solid_queue:setup && bundle exec rails release:increment_version
