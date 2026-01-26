import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import PurchaseOrdersPageClient from "./purchase-orders-page-client";

export default createFoundationMainPage("purchase-orders", "/purchase_orders", PurchaseOrdersPageClient);
