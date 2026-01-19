import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import PricebookPageClient from "./pricebook-page-client";

export default createFoundationMainPage("pricebook-items", "/pricebook", PricebookPageClient, { includeGroupCounts: true });
