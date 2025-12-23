# frozen_string_literal: true

module Performance
  # Self-Flushing Request Buffer for Heroku
  #
  # Collects performance metrics in memory and flushes them INLINE on the web dyno.
  # This is required because Heroku web and worker dynos have separate memory spaces.
  #
  # Flush triggers:
  # - Buffer reaches 50 items (batch efficiency)
  # - 30 seconds since last flush (time-based guarantee)
  # - Buffer reaches MAX_BUFFER_SIZE (safety limit)
  #
  # Thread-safe implementation using Concurrent::Array and Mutex
  #
  # Usage:
  #   Performance::Buffer.push_request(data)
  #   Performance::Buffer.push_vital(data)
  #   Performance::Buffer.flush!  # Manual flush (also called inline)
  #
  class Buffer
    # Flush when buffer reaches this size (balance between batching and memory)
    FLUSH_THRESHOLD = 50

    # Maximum buffer size before forced flush (safety limit)
    MAX_BUFFER_SIZE = 1000

    # Flush if this many seconds have passed since last flush
    FLUSH_INTERVAL_SECONDS = 30

    # Sampling rate (0.0 to 1.0) - capture this percentage of requests
    # 0.1 = 10% of requests are sampled
    SAMPLE_RATE = ENV.fetch("PERFORMANCE_SAMPLE_RATE", "0.1").to_f

    class << self
      # Thread-safe request buffer
      def request_buffer
        @request_buffer ||= Concurrent::Array.new
      end

      # Thread-safe vital buffer
      def vital_buffer
        @vital_buffer ||= Concurrent::Array.new
      end

      # Thread-safe slow query buffer
      def slow_query_buffer
        @slow_query_buffer ||= Concurrent::Array.new
      end

      # Mutex to prevent concurrent flushes
      def flush_mutex
        @flush_mutex ||= Mutex.new
      end

      # Track last flush time
      def last_flush_time
        @last_flush_time ||= Time.current
      end

      def last_flush_time=(time)
        @last_flush_time = time
      end

      # Push a request timing to the buffer
      # May trigger inline flush if thresholds met
      def push_request(data)
        return unless should_sample?
        return if request_buffer.length >= MAX_BUFFER_SIZE

        request_buffer << data.merge(sampled_at: Time.current)
        maybe_flush_inline
      end

      # Push a web vital to the buffer (always capture vitals)
      def push_vital(data)
        return if vital_buffer.length >= MAX_BUFFER_SIZE

        vital_buffer << data.merge(received_at: Time.current)
        maybe_flush_inline
      end

      # Push a slow query to the buffer (always capture slow queries)
      def push_slow_query(data)
        return if slow_query_buffer.length >= MAX_BUFFER_SIZE

        slow_query_buffer << data.merge(captured_at: Time.current)
        maybe_flush_inline
      end

      # Flush all buffers to database
      # Called by FlushPerformanceBufferJob
      def flush!
        flush_requests!
        flush_vitals!
        flush_slow_queries!
      end

      # Flush request buffer
      def flush_requests!
        return if request_buffer.empty?

        # Atomically swap buffer
        requests = []
        requests << request_buffer.shift until request_buffer.empty?

        return if requests.empty?

        # Bulk insert for efficiency
        records = requests.map do |data|
          {
            endpoint: data[:endpoint],
            method: data[:method],
            duration_ms: data[:duration_ms],
            db_time_ms: data[:db_time_ms],
            view_time_ms: data[:view_time_ms],
            status_code: data[:status_code],
            user_id: data[:user_id],
            organization_id: data[:organization_id],
            controller_action: data[:controller_action],
            metadata: data[:metadata] || {},
            created_at: data[:sampled_at] || Time.current,
            updated_at: Time.current
          }
        end

        PerformanceRequest.insert_all(records)
        Rails.logger.info "[Performance::Buffer] Flushed #{records.length} requests"
      rescue => e
        Rails.logger.error "[Performance::Buffer] Failed to flush requests: #{e.message}"
        # Don't re-raise - we don't want to crash the job
      end

      # Flush vital buffer
      def flush_vitals!
        return if vital_buffer.empty?

        vitals = []
        vitals << vital_buffer.shift until vital_buffer.empty?

        return if vitals.empty?

        records = vitals.map do |data|
          {
            metric_name: data[:metric_name],
            value: data[:value],
            page_path: data[:page_path],
            session_id: data[:session_id],
            user_agent: data[:user_agent],
            user_id: data[:user_id],
            rating: data[:rating],
            metadata: data[:metadata] || {},
            created_at: data[:received_at] || Time.current,
            updated_at: Time.current
          }
        end

        PerformanceVital.insert_all(records)
        Rails.logger.info "[Performance::Buffer] Flushed #{records.length} vitals"
      rescue => e
        Rails.logger.error "[Performance::Buffer] Failed to flush vitals: #{e.message}"
      end

      # Flush slow query buffer
      def flush_slow_queries!
        return if slow_query_buffer.empty?

        queries = []
        queries << slow_query_buffer.shift until slow_query_buffer.empty?

        return if queries.empty?

        records = queries.map do |data|
          {
            query_fingerprint: data[:query_fingerprint],
            duration_ms: data[:duration_ms],
            table_name: data[:table_name],
            operation: data[:operation],
            caller_location: data[:caller_location],
            user_id: data[:user_id],
            endpoint: data[:endpoint],
            metadata: data[:metadata] || {},
            created_at: data[:captured_at] || Time.current,
            updated_at: Time.current
          }
        end

        PerformanceSlowQuery.insert_all(records)
        Rails.logger.info "[Performance::Buffer] Flushed #{records.length} slow queries"
      rescue => e
        Rails.logger.error "[Performance::Buffer] Failed to flush slow queries: #{e.message}"
      end

      # Buffer stats for monitoring
      def stats
        {
          requests: request_buffer.length,
          vitals: vital_buffer.length,
          slow_queries: slow_query_buffer.length,
          sample_rate: SAMPLE_RATE,
          flush_threshold: FLUSH_THRESHOLD,
          max_size: MAX_BUFFER_SIZE,
          seconds_since_flush: (Time.current - last_flush_time).round(1)
        }
      end

      # Clear all buffers (for testing)
      def clear!
        request_buffer.clear
        vital_buffer.clear
        slow_query_buffer.clear
        self.last_flush_time = Time.current
      end

      private

      # Probabilistic sampling
      def should_sample?
        rand < SAMPLE_RATE
      end

      # Check if we should flush inline (called after each push)
      # Flushes if:
      # - Buffer size >= FLUSH_THRESHOLD (50 items)
      # - OR time since last flush >= FLUSH_INTERVAL_SECONDS (30s)
      # - OR buffer is nearly full (safety)
      def maybe_flush_inline
        total = request_buffer.length + vital_buffer.length + slow_query_buffer.length
        time_since_flush = Time.current - last_flush_time

        should_flush = total >= FLUSH_THRESHOLD ||
                       time_since_flush >= FLUSH_INTERVAL_SECONDS ||
                       total >= MAX_BUFFER_SIZE * 0.8

        return unless should_flush

        # Use non-blocking try_lock to avoid blocking requests
        # If another thread is flushing, skip this flush
        return unless flush_mutex.try_lock

        begin
          flush!
          self.last_flush_time = Time.current
        ensure
          flush_mutex.unlock
        end
      rescue => e
        # Never crash the request due to flush errors
        Rails.logger.error "[Performance::Buffer] Inline flush error: #{e.message}"
      end
    end
  end
end
