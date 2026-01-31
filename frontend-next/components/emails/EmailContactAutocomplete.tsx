"use client";

import * as React from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { X, Building2, Briefcase, Mail, ExternalLink } from "lucide-react";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import type { EmailContact, ContactEmail } from "@/lib/email-types";

/** Chip data includes contact info for navigation */
interface EmailChip {
  email: string;
  contactId?: number;
  displayName?: string;
}

interface EmailContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  contacts: EmailContact[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  minSearchChars?: number;
}

/**
 * Represents a single selectable item in the dropdown.
 * Could be a contact with single email or one email of a multi-email contact.
 * Optionally linked to a specific job.
 */
interface SelectableItem {
  contact: EmailContact;
  email: string;
  emailLabel?: string | null;
  isPrimary?: boolean;
  job?: {
    id: number;
    name: string;
    job_code: string | null;
    location: string | null;
    role: string | null;
  };
}

export function EmailContactAutocomplete({
  value,
  onChange,
  contacts,
  isLoading,
  onSearch,
  placeholder = "",
  className,
  minSearchChars = 2,
}: EmailContactAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchInput, setSearchInput] = useState(""); // Just the current search text
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());
  const [chips, setChips] = useState<EmailChip[]>([]); // Internal state with contact info
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync chips from external value (initial load / external changes)
  useEffect(() => {
    if (!value) {
      setChips([]);
      return;
    }
    const emails = value.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    // Only update if emails changed (preserve contact info for existing chips)
    const currentEmails = chips.map(c => c.email);
    if (JSON.stringify(emails) !== JSON.stringify(currentEmails)) {
      // Map emails to chips, preserving contact info for matching emails
      const newChips = emails.map(email => {
        const existing = chips.find(c => c.email === email);
        return existing || { email };
      });
      setChips(newChips);
    }
  }, [value]);

  // Get just emails for filtering (used to skip already-added contacts)
  const emailChips = useMemo(() => chips.map(c => c.email), [chips]);

  // Update parent value from chips
  const updateChips = (newChips: EmailChip[]) => {
    setChips(newChips);
    const newValue = newChips.length > 0 ? newChips.map(c => c.email).join(", ") : "";
    onChange(newValue);
  };

  // Remove a chip by index
  const removeChip = (index: number) => {
    const newChips = [...chips];
    newChips.splice(index, 1);
    updateChips(newChips);
  };

  // Navigate to contact page
  const openContact = (contactId: number) => {
    // Open in new tab so user doesn't lose their email draft
    window.open(`/contacts/${contactId}`, '_blank');
  };

  // Get the current search term for sorting
  const currentSearchTerm = useMemo(() => {
    return searchInput.toLowerCase().trim();
  }, [searchInput]);

  // Sort contacts by relevance: prefix matches first, then contains
  const sortedContacts = useMemo(() => {
    if (!currentSearchTerm) return contacts;

    return [...contacts].sort((a, b) => {
      const aName = a.display_name.toLowerCase();
      const bName = b.display_name.toLowerCase();
      const aStartsWith = aName.startsWith(currentSearchTerm);
      const bStartsWith = bName.startsWith(currentSearchTerm);

      // Prefix matches come first
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Then sort alphabetically
      return aName.localeCompare(bName);
    });
  }, [contacts, currentSearchTerm]);

  // Group contacts by company (maintaining sort order within groups)
  // Company contacts with emails are ALSO shown under their own name as selectable items
  const groupedContacts = useMemo(() => {
    const groups: Record<string, EmailContact[]> = {};

    // First pass: group by primary_company
    sortedContacts.forEach((contact) => {
      const companyName = contact.primary_company?.name || "Other";
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(contact);
    });

    // Second pass: For company contacts in "Other" that have employees elsewhere,
    // move them to their own group so you can select the company email directly
    const otherContacts = groups["Other"] || [];
    const contactsToRemoveFromOther: number[] = [];
    otherContacts.forEach((contact) => {
      // If this is a company/trust contact that appears as a group header elsewhere,
      // move it to that group so users can select the company's own email
      const hasEmail = contact.email || (contact.contact_emails && contact.contact_emails.length > 0);
      if (groups[contact.display_name] && hasEmail) {
        // Add at the beginning of the group (company first, then employees)
        groups[contact.display_name].unshift(contact);
        // Mark for removal from "Other"
        contactsToRemoveFromOther.push(contact.id);
      }
    });
    // Remove moved contacts from "Other"
    if (contactsToRemoveFromOther.length > 0 && groups["Other"]) {
      groups["Other"] = groups["Other"].filter(c => !contactsToRemoveFromOther.includes(c.id));
      // If "Other" is now empty, remove it entirely
      if (groups["Other"].length === 0) {
        delete groups["Other"];
      }
    }

    // Sort groups: groups with prefix-matching contacts first
    const sortedEntries = Object.entries(groups).sort(([, aContacts], [, bContacts]) => {
      const aHasPrefix = aContacts.some(c => c.display_name.toLowerCase().startsWith(currentSearchTerm));
      const bHasPrefix = bContacts.some(c => c.display_name.toLowerCase().startsWith(currentSearchTerm));
      if (aHasPrefix && !bHasPrefix) return -1;
      if (!aHasPrefix && bHasPrefix) return 1;
      return 0;
    });

    return Object.fromEntries(sortedEntries);
  }, [sortedContacts, currentSearchTerm]);

  // Build flat list of selectable items (for keyboard navigation)
  // Each email + job combination becomes a separate item
  // If contact has jobs, create one row per job; if no jobs, just one row
  const selectableItems = useMemo(() => {
    const items: SelectableItem[] = [];
    Object.entries(groupedContacts).forEach(([companyName, companyContacts]) => {
      if (collapsedCompanies.has(companyName)) return; // Skip collapsed companies

      companyContacts.forEach((contact) => {
        // Get all emails for this contact
        const emails = contact.contact_emails && contact.contact_emails.length > 0
          ? contact.contact_emails
          : contact.email ? [{ id: 0, email: contact.email, is_primary: true, label: null }] : [];

        // Get jobs (or create a single "no job" entry)
        const jobs = contact.jobs && contact.jobs.length > 0
          ? contact.jobs
          : [undefined]; // One entry with no job

        // Create item for each email + job combination
        emails.forEach((emailObj: ContactEmail | { id: number; email: string; is_primary: boolean; label: null }) => {
          // Skip emails already in chips
          if (emailChips.includes(emailObj.email)) return;

          jobs.forEach((job) => {
            items.push({
              contact,
              email: emailObj.email,
              emailLabel: emailObj.label,
              isPrimary: emailObj.is_primary,
              job: job,
            });
          });
        });
      });
    });
    return items;
  }, [groupedContacts, collapsedCompanies, emailChips]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const items = listRef.current.querySelectorAll("[data-contact-item]");
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchInput(newValue);

    if (newValue.trim().length >= minSearchChars) {
      onSearch(newValue.trim());
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setHighlightedIndex(0);
    // Reset collapsed state on new search
    setCollapsedCompanies(new Set());
  };

  const handleSelectItem = (item: SelectableItem) => {
    // Add selected email to chips with contact info
    const newChip: EmailChip = {
      email: item.email,
      contactId: item.contact.id,
      displayName: item.contact.display_name,
    };
    const newChips = [...chips, newChip];
    updateChips(newChips);
    setSearchInput(""); // Clear search input
    onSearch(""); // Clear search so next search works fresh
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    updateChips([]);
    setSearchInput("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const toggleCompany = (companyName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyName)) {
        next.delete(companyName);
      } else {
        next.add(companyName);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to remove last chip when input is empty
    if (e.key === "Backspace" && searchInput === "" && emailChips.length > 0) {
      e.preventDefault();
      removeChip(emailChips.length - 1);
      return;
    }

    if (!isOpen) {
      if (e.key === "ArrowDown" && selectableItems.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < selectableItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : selectableItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectableItems.length > 0 && highlightedIndex < selectableItems.length) {
          handleSelectItem(selectableItems[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    if (searchInput.trim().length >= minSearchChars && contacts.length > 0) {
      setIsOpen(true);
    }
  };

  const showDropdown = isOpen && (isLoading || contacts.length > 0);

  // Track which index each item is at for highlighting
  let globalIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Chips + Input container */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 min-h-[32px] w-full",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Email chips - click opens contact page, X to delete */}
        {chips.map((chip, index) => (
          <span
            key={`${chip.email}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm max-w-[200px] group"
          >
            {/* Clickable email - opens contact page */}
            <span
              className={cn(
                "truncate",
                chip.contactId && "cursor-pointer hover:underline"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (chip.contactId) {
                  openContact(chip.contactId);
                }
              }}
              title={chip.contactId ? `Open ${chip.displayName || 'contact'} in new tab` : chip.email}
            >
              {chip.email}
            </span>
            {/* Link icon for contacts */}
            {chip.contactId && (
              <ExternalLink
                className="h-3 w-3 opacity-50 group-hover:opacity-100 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openContact(chip.contactId!);
                }}
              />
            )}
            {/* Delete button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeChip(index);
              }}
              className="hover:bg-primary/30 rounded p-0.5 -mr-1"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={emailChips.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] h-7 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* Clear all button */}
        {(emailChips.length > 0 || searchInput) && (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
            onClick={handleClear}
          />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border rounded-md shadow-lg max-h-[450px] overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size={20} className="text-muted-foreground" />
            </div>
          ) : (
            Object.entries(groupedContacts).map(([companyName, companyContacts]) => {
              const isCollapsed = collapsedCompanies.has(companyName);
              // Count total emails in this group
              const totalEmails = companyContacts.reduce((sum, c) => {
                const emailCount = c.contact_emails && c.contact_emails.length > 0
                  ? c.contact_emails.length
                  : c.email ? 1 : 0;
                return sum + emailCount;
              }, 0);

              return (
                <div key={companyName}>
                  {/* Clickable company header with expand/collapse */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-muted/50 cursor-pointer hover:bg-muted select-none"
                    onClick={(e) => toggleCompany(companyName, e)}
                  >
                    <ExpandChevron expanded={!isCollapsed} size={14} />
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{companyName}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {totalEmails}
                    </span>
                  </div>

                  {/* Contacts in this company (collapsible) */}
                  {/* Each email+job combination is a separate row */}
                  {!isCollapsed && companyContacts.map((contact) => {
                    // Get all emails for this contact
                    const emails = contact.contact_emails && contact.contact_emails.length > 0
                      ? contact.contact_emails
                      : contact.email ? [{ id: 0, email: contact.email, is_primary: true, label: null }] : [];

                    // Get jobs (or single undefined entry for no job)
                    const jobs = contact.jobs && contact.jobs.length > 0
                      ? contact.jobs
                      : [undefined];

                    // Show each email + job combination as a separate selectable row
                    return emails.flatMap((emailObj, emailIdx) => {
                      // Skip emails already in chips
                      if (emailChips.includes(emailObj.email)) return [];

                      return jobs.map((job, jobIdx) => {
                        const currentIndex = globalIndex++;
                        const isHighlighted = currentIndex === highlightedIndex;
                        const isFirstRow = emailIdx === 0 && jobIdx === 0;

                        return (
                          <div
                            key={`${contact.id}-${emailObj.email}-${job?.id || 'no-job'}`}
                            data-contact-item
                            className={cn(
                              "px-3 py-2 cursor-pointer pl-7",
                              isHighlighted ? "bg-primary text-white" : "hover:bg-accent/50"
                            )}
                            onClick={() => handleSelectItem({
                              contact,
                              email: emailObj.email,
                              emailLabel: emailObj.label,
                              isPrimary: emailObj.is_primary,
                              job: job,
                            })}
                            onMouseEnter={() => setHighlightedIndex(currentIndex)}
                          >
                            {/* Contact name - show on first row or when job changes context */}
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {contact.display_name}
                              </span>
                              {/* Show "via job" badge for contacts found through job colleague expansion */}
                              {contact.found_via_job && contact.related_jobs?.[0] && (
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap",
                                  isHighlighted ? "bg-white/20 text-white" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                )}>
                                  via {contact.related_jobs[0].location || contact.related_jobs[0].name}
                                </span>
                              )}
                            </div>
                            {/* Job location for THIS row */}
                            {job && (
                              <div className={cn(
                                "flex items-center gap-1 text-[10px] mt-0.5",
                                isHighlighted ? "text-white/90" : "text-blue-600 dark:text-blue-400"
                              )}>
                                <Briefcase className="h-3 w-3" />
                                <span className="truncate">
                                  {job.location || job.name}
                                </span>
                              </div>
                            )}
                            {/* Email row */}
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs mt-0.5",
                              isHighlighted ? "text-white/80" : "text-muted-foreground"
                            )}>
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{emailObj.email}</span>
                              {emailObj.label && (
                                <span className={cn(
                                  "text-[10px] px-1 py-0.5 rounded",
                                  isHighlighted ? "bg-white/20 text-white" : "bg-muted"
                                )}>
                                  {emailObj.label}
                                </span>
                              )}
                              {emails.length > 1 && emailObj.is_primary && (
                                <span className={cn(
                                  "text-[10px] px-1 py-0.5 rounded",
                                  isHighlighted ? "bg-white/20 text-white" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                )}>
                                  primary
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    });
                  })}
                </div>
              );
            })
          )}

          {/* Allow using typed value as custom email */}
          {!isLoading && contacts.length === 0 && searchInput.length >= minSearchChars && (
            <div
              className="px-3 py-2 cursor-pointer hover:bg-accent/50 text-sm"
              onClick={() => {
                // Add as custom email (no contact link)
                const newChip: EmailChip = { email: searchInput.trim() };
                updateChips([...chips, newChip]);
                setSearchInput("");
                setIsOpen(false);
              }}
            >
              Add: <strong>{searchInput}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
