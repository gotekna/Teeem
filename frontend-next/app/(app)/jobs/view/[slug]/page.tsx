import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
import JobsPageClient from "../../jobs-page-client";

export default createFoundationViewPage("jobs", JobsPageClient, { includeGroupCounts: true });
