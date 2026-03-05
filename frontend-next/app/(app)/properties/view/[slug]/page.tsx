import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
import PropertiesPageClient from "../../properties-page-client";

export default createFoundationViewPage("properties", PropertiesPageClient, { includeGroupCounts: true });
