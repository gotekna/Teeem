import { redirect } from "next/navigation";

/**
 * Warehouse Config Root - redirects to default scope
 * SSoT (Feb 2026): Renamed from entity-config → folder-config → warehouse-config
 */
export default function WarehouseConfigRootPage() {
  redirect("/admin/system/warehouse-config/warehouse_folders");
}
