# frozen_string_literal: true

# Load TenantErrors early so the constants are available everywhere
# This is needed because lib/ autoloading may not load this before services need it
require_relative "../../lib/tenant_errors"
