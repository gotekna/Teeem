import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
import ContactsPageClient from "../../contacts-page-client";

export default createFoundationViewPage("contacts", ContactsPageClient, { includeGroupCounts: true });
