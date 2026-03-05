import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
import PropertiesListClient from "../../properties-list-client";

export default createFoundationViewPage("properties", PropertiesListClient, { includeGroupCounts: true });
