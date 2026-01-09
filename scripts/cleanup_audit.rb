#!/usr/bin/env ruby
# frozen_string_literal: true

# TEEEM Codebase Cleanup Audit Script
# This script identifies duplicate/stale code at root level that exists in /backend/
# Run with: ruby scripts/cleanup_audit.rb

require 'fileutils'
require 'digest'

class CleanupAudit
  ROOT_DIR = File.expand_path('..', __dir__)
  BACKEND_DIR = File.join(ROOT_DIR, 'backend')

  # Directories that should ONLY exist in /backend/
  BACKEND_ONLY_DIRS = %w[
    app
    config
    db
    lib
    bin
    public
    storage
    vendor
  ].freeze

  # Files that should ONLY exist in /backend/
  BACKEND_ONLY_FILES = %w[
    Gemfile
    Gemfile.lock
    Rakefile
    config.ru
    Procfile
  ].freeze

  # Directories that should stay at root (not duplicates)
  KEEP_AT_ROOT = %w[
    .claude
    .git
    .github
    backend
    frontend
    frontend-next
    scripts
    TEEEM_DOCS
    node_modules
  ].freeze

  # Files that should stay at root
  KEEP_FILES_AT_ROOT = %w[
    .gitignore
    .ruby-version
    README.md
    LICENSE
  ].freeze

  def initialize
    @safe_to_delete = []
    @needs_review = []
    @keep = []
    @conflicts = []
  end

  def run
    puts "=" * 80
    puts "TEEEM CODEBASE CLEANUP AUDIT"
    puts "=" * 80
    puts ""
    puts "Root directory: #{ROOT_DIR}"
    puts "Backend directory: #{BACKEND_DIR}"
    puts ""

    audit_root_directories
    audit_root_files
    compare_duplicate_files
    generate_report
    generate_cleanup_script
  end

  private

  def audit_root_directories
    puts "Auditing root-level directories..."
    puts "-" * 40

    Dir.entries(ROOT_DIR).each do |entry|
      next if entry.start_with?('.')
      next unless File.directory?(File.join(ROOT_DIR, entry))

      if KEEP_AT_ROOT.include?(entry)
        @keep << { type: 'directory', path: entry, reason: 'Required at root level' }
      elsif BACKEND_ONLY_DIRS.include?(entry)
        backend_path = File.join(BACKEND_DIR, entry)
        if File.exist?(backend_path)
          @safe_to_delete << {
            type: 'directory',
            path: entry,
            reason: "Duplicate exists in /backend/#{entry}",
            size: directory_size(File.join(ROOT_DIR, entry))
          }
        else
          @needs_review << { type: 'directory', path: entry, reason: 'No backend equivalent found' }
        end
      else
        @needs_review << { type: 'directory', path: entry, reason: 'Unknown directory' }
      end
    end
  end

  def audit_root_files
    puts "Auditing root-level files..."
    puts "-" * 40

    Dir.entries(ROOT_DIR).each do |entry|
      next if entry.start_with?('.')
      full_path = File.join(ROOT_DIR, entry)
      next unless File.file?(full_path)

      if KEEP_FILES_AT_ROOT.include?(entry)
        @keep << { type: 'file', path: entry, reason: 'Required at root level' }
      elsif BACKEND_ONLY_FILES.include?(entry)
        backend_path = File.join(BACKEND_DIR, entry)
        if File.exist?(backend_path)
          if files_identical?(full_path, backend_path)
            @safe_to_delete << {
              type: 'file',
              path: entry,
              reason: "Identical copy exists in /backend/#{entry}",
              size: File.size(full_path)
            }
          else
            @conflicts << {
              type: 'file',
              path: entry,
              reason: "DIFFERENT from /backend/#{entry}",
              root_size: File.size(full_path),
              backend_size: File.size(backend_path)
            }
          end
        else
          @needs_review << { type: 'file', path: entry, reason: 'No backend equivalent found' }
        end
      else
        @needs_review << { type: 'file', path: entry, reason: 'Unknown file' }
      end
    end
  end

  def compare_duplicate_files
    puts "Comparing duplicate files in detail..."
    puts "-" * 40

    # Compare specific important files
    comparisons = [
      ['config/routes.rb', 'backend/config/routes.rb'],
      ['config/application.rb', 'backend/config/application.rb'],
      ['config/database.yml', 'backend/config/database.yml'],
      ['Gemfile', 'backend/Gemfile'],
    ]

    comparisons.each do |root_file, backend_file|
      root_path = File.join(ROOT_DIR, root_file)
      backend_path = File.join(ROOT_DIR, backend_file)

      next unless File.exist?(root_path) && File.exist?(backend_path)

      if files_identical?(root_path, backend_path)
        puts "  [IDENTICAL] #{root_file}"
      else
        root_lines = File.readlines(root_path).length
        backend_lines = File.readlines(backend_path).length
        puts "  [DIFFERENT] #{root_file}: root=#{root_lines} lines, backend=#{backend_lines} lines"
      end
    end
  end

  def generate_report
    puts ""
    puts "=" * 80
    puts "AUDIT RESULTS"
    puts "=" * 80

    # Safe to delete
    puts ""
    puts "SAFE TO DELETE (#{@safe_to_delete.length} items):"
    puts "-" * 40
    total_size = 0
    @safe_to_delete.each do |item|
      size = item[:size] || 0
      total_size += size
      puts "  [#{item[:type].upcase}] #{item[:path]}"
      puts "    Reason: #{item[:reason]}"
      puts "    Size: #{format_size(size)}" if size > 0
    end
    puts ""
    puts "  Total size to reclaim: #{format_size(total_size)}"

    # Conflicts (need manual review)
    if @conflicts.any?
      puts ""
      puts "CONFLICTS - NEED MANUAL REVIEW (#{@conflicts.length} items):"
      puts "-" * 40
      @conflicts.each do |item|
        puts "  [#{item[:type].upcase}] #{item[:path]}"
        puts "    Issue: #{item[:reason]}"
        puts "    Root size: #{format_size(item[:root_size])}, Backend size: #{format_size(item[:backend_size])}"
      end
    end

    # Needs review
    if @needs_review.any?
      puts ""
      puts "NEEDS REVIEW (#{@needs_review.length} items):"
      puts "-" * 40
      @needs_review.each do |item|
        puts "  [#{item[:type].upcase}] #{item[:path]}"
        puts "    Reason: #{item[:reason]}"
      end
    end

    # Keep
    puts ""
    puts "KEEP AT ROOT (#{@keep.length} items):"
    puts "-" * 40
    @keep.each do |item|
      puts "  [#{item[:type].upcase}] #{item[:path]}"
    end
  end

  def generate_cleanup_script
    script_path = File.join(ROOT_DIR, 'scripts', 'do_cleanup.sh')

    File.open(script_path, 'w') do |f|
      f.puts "#!/bin/bash"
      f.puts "# TEEEM Cleanup Script - Generated #{Time.now}"
      f.puts "# This script removes duplicate root-level code that exists in /backend/"
      f.puts "#"
      f.puts "# REVIEW THIS CAREFULLY BEFORE RUNNING!"
      f.puts "# Run with: bash scripts/do_cleanup.sh"
      f.puts ""
      f.puts "set -e  # Exit on error"
      f.puts ""
      f.puts "echo '================================================'"
      f.puts "echo 'TEEEM Codebase Cleanup'"
      f.puts "echo '================================================'"
      f.puts "echo ''"
      f.puts ""
      f.puts "# Change to repo root"
      f.puts "cd \"$(dirname \"$0\")/..\""
      f.puts ""
      f.puts "echo 'Current directory:' $(pwd)"
      f.puts "echo ''"
      f.puts ""
      f.puts "# Safety check - ensure we're in the right repo"
      f.puts "if [ ! -d \"backend\" ] || [ ! -d \"frontend-next\" ]; then"
      f.puts "  echo 'ERROR: This does not look like the TEEEM repo!'"
      f.puts "  exit 1"
      f.puts "fi"
      f.puts ""
      f.puts "echo 'This will delete the following duplicate directories/files:'"
      f.puts "echo ''"

      @safe_to_delete.each do |item|
        f.puts "echo '  - #{item[:path]}'"
      end

      f.puts ""
      f.puts "echo ''"
      f.puts "read -p 'Are you sure you want to proceed? (yes/no): ' confirm"
      f.puts ""
      f.puts "if [ \"$confirm\" != \"yes\" ]; then"
      f.puts "  echo 'Aborted.'"
      f.puts "  exit 0"
      f.puts "fi"
      f.puts ""
      f.puts "echo ''"
      f.puts "echo 'Creating backup branch...'"
      f.puts "git checkout -b backup-before-cleanup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true"
      f.puts "git checkout -"
      f.puts ""
      f.puts "echo 'Removing duplicate files and directories...'"
      f.puts ""

      @safe_to_delete.each do |item|
        if item[:type] == 'directory'
          f.puts "echo 'Removing directory: #{item[:path]}'"
          f.puts "rm -rf \"#{item[:path]}\""
        else
          f.puts "echo 'Removing file: #{item[:path]}'"
          f.puts "rm -f \"#{item[:path]}\""
        end
        f.puts ""
      end

      f.puts "echo ''"
      f.puts "echo '================================================'"
      f.puts "echo 'Cleanup complete!'"
      f.puts "echo '================================================'"
      f.puts "echo ''"
      f.puts "echo 'Next steps:'"
      f.puts "echo '1. Run: git status'"
      f.puts "echo '2. Review the changes'"
      f.puts "echo '3. Commit with: git add -A && git commit -m \"chore: Remove duplicate root-level Rails code\"'"
      f.puts "echo '4. Push to GitHub'"
      f.puts ""
    end

    FileUtils.chmod(0755, script_path)

    puts ""
    puts "=" * 80
    puts "CLEANUP SCRIPT GENERATED"
    puts "=" * 80
    puts ""
    puts "Script location: #{script_path}"
    puts ""
    puts "To run the cleanup:"
    puts "  1. Review the script: cat scripts/do_cleanup.sh"
    puts "  2. Run it: bash scripts/do_cleanup.sh"
    puts ""
  end

  def files_identical?(file1, file2)
    return false unless File.exist?(file1) && File.exist?(file2)
    Digest::MD5.file(file1) == Digest::MD5.file(file2)
  end

  def directory_size(path)
    return 0 unless File.directory?(path)
    Dir.glob(File.join(path, '**', '*'))
       .select { |f| File.file?(f) }
       .sum { |f| File.size(f) }
  end

  def format_size(bytes)
    return '0 B' if bytes == 0
    units = ['B', 'KB', 'MB', 'GB']
    exp = (Math.log(bytes) / Math.log(1024)).to_i
    exp = units.length - 1 if exp >= units.length
    "%.1f %s" % [bytes.to_f / (1024 ** exp), units[exp]]
  end
end

# Run the audit
CleanupAudit.new.run
