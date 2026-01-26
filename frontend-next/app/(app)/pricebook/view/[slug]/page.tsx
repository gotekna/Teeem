import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
import PricebookPageClient from "../../pricebook-page-client";

export default createFoundationViewPage("pricebook-items", PricebookPageClient, { includeGroupCounts: true });
