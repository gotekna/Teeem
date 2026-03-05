import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import PropertiesPageClient from "./properties-page-client";

export default createFoundationMainPage("properties", "/properties", PropertiesPageClient, { includeGroupCounts: true });
