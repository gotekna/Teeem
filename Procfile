web: bundle exec puma -C config/puma.rb
worker: bundle exec rails solid_queue:start
release: bundle exec rails db:migrate && bundle exec rails solid_queue:setup && bundle exec rails release:increment_version
