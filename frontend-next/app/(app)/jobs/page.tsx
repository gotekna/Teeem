import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import JobsPageClient from "./jobs-page-client";

export default createFoundationMainPage("jobs", "/jobs", JobsPageClient, { includeGroupCounts: true });
