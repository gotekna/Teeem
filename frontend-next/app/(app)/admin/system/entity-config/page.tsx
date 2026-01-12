import { redirect } from "next/navigation";

/**
 * Entity Config Root - redirects to default scope
 */
export default function EntityConfigRootPage() {
  redirect("/admin/system/entity-config/corporate_entity");
}
