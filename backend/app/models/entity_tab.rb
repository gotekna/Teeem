# frozen_string_literal: true

# DEPRECATED: Use WarehouseFolder instead
# This alias exists for backward compatibility during migration
# All new code should use WarehouseFolder
#
# SSoT Rename (Jan 2026): EntityTab → StorageLocation → WarehouseFolder
# "WarehouseFolder" is clearest - it's the folder configuration for File Warehouse
EntityTab = WarehouseFolder
StorageLocation = WarehouseFolder
