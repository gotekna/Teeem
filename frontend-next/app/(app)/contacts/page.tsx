import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
import ContactsPageClient from "./contacts-page-client";

export default createFoundationMainPage("contacts", "/contacts", ContactsPageClient, { includeGroupCounts: true });
