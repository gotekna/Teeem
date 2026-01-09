web: bundle exec puma -C config/puma.rb
worker: bundle exec bin/jobs
release: bundle exec rails deploy:prepare && bundle exec rails release:increment_version && bundle exec rails queue:setup
