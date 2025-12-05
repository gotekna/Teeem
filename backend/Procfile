web: bundle exec puma -C config/puma.rb
worker: SOLID_QUEUE_SUPERVISOR=1 SOLID_QUEUE_DISPATCHER=1 SOLID_QUEUE_WORKER=1 bundle exec rails solid_queue:start
scheduler: SOLID_QUEUE_SCHEDULER=1 bundle exec rails solid_queue:start
release: bundle exec rails db:migrate && bundle exec rails solid_queue:setup && bundle exec rails release:increment_version
