import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import PropertiesListClient from "./properties-list-client";

export default createFoundationMainPage("properties", "/properties/list", PropertiesListClient, { includeGroupCounts: true });
