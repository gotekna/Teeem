'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Spinner } from "@/components/ui/spinner";
import { api } from '@/lib/api';
import {
  Mail,
  FileText,
  Upload,
  X,
  Search,
  Building2,
  User,
  Briefcase,
  UserCircle,
  CheckSquare,
  GripVertical,
} from "lucide-react";

export interface PendingAttachment {
  type: 'email' | 'document' | 'upload';
  id?: number;
  file?: File;
  displayName: string;
  metadata?: Record<string, unknown>;
}

interface AttachmentPickerProps {
  attachments: PendingAttachment[];
  onAdd: (attachment: PendingAttachment) => void;
  onRemove: (index: number) => void;
  jobId?: string;
}

interface EmailResult {
  id: number;
  subject: string;
  from_email: string;
  received_at: string;
  has_attachments?: boolean;
  mailbox?: string;
  to_emails?: string[];
}

interface DocumentResult {
  id: number;
  name: string;
  display_title?: string;
  source_type: 'corporate' | 'user' | 'job' | 'contact' | 'task';
  document_type?: { id: number; name: string; abbreviation: string } | null;
  url?: string;
  file_url?: string;
}

// Source type display config
const SOURCE_CONFIG: Record<DocumentResult['source_type'], { label: string; icon: typeof Building2; color: string }> = {
  corporate: { label: 'Company', icon: Building2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  user: { label: 'My Docs', icon: User, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  job: { label: 'Job', icon: Briefcase, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  contact: { label: 'Contact', icon: UserCircle, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  task: { label: 'Task', icon: CheckSquare, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
};

export function AttachmentPicker({ attachments, onAdd, onRemove, jobId }: AttachmentPickerProps) {
  const [activeTab, setActiveTab] = React.useState<'email' | 'document' | 'upload'>('email');

  return (
    <div className="space-y-3">
      {/* Attached Items */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <Badge key={idx} variant="secondary" className="flex items-center gap-1 pr-1">
              {att.type === 'email' && <Mail className="h-3 w-3" />}
              {att.type === 'document' && <FileText className="h-3 w-3" />}
              {att.type === 'upload' && <Upload className="h-3 w-3" />}
              <span className="max-w-[150px] truncate">{att.displayName}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-1 hover:bg-destructive/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Picker Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email" className="flex items-center gap-1 text-xs">
            <Mail className="h-3 w-3" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-1 text-xs">
            <FileText className="h-3 w-3" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1 text-xs">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-2">
          <EmailSearchPanel onSelect={onAdd} jobId={jobId} />
        </TabsContent>

        <TabsContent value="document" className="mt-2">
          <DocumentBrowserPanel onSelect={onAdd} />
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <FileUploadPanel onSelect={onAdd} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailSearchPanel({
  onSelect,
  jobId,
}: {
  onSelect: (att: PendingAttachment) => void;
  jobId?: string;
}) {
  const [search, setSearch] = React.useState('');
  const [emails, setEmails] = React.useState<EmailResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const searchEmails = React.useCallback(async (query: string) => {
    if (!query.trim()) {
      setEmails([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ search: query, limit: '20' });
      if (jobId) params.append('job_id', jobId);

      const response = await api.get<{ emails?: EmailResult[] } | EmailResult[]>(
        `/api/v1/synced_emails?${params}`
      );
      const emailList = Array.isArray(response) ? response : response?.emails || [];
      setEmails(emailList);
    } catch (error) {
      console.error('Failed to search emails:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Debounced search-as-you-type
  React.useEffect(() => {
    const timer = setTimeout(() => {
      searchEmails(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchEmails]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search all emails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm pr-8"
        />
        {loading ? (
          <Spinner size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Results */}
      <div className="max-h-[320px] overflow-y-auto space-y-1">
        {emails.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Search for emails by subject, sender, or content
          </p>
        )}
        {emails.map((email) => {
          // Use mailbox if available, otherwise fall back to first "to" email
          const receivingAccount = email.mailbox || email.to_emails?.[0];
          return (
            <Card
              key={email.id}
              className="p-2 cursor-pointer hover:bg-accent transition-colors"
              onClick={() =>
                onSelect({
                  type: 'email',
                  id: email.id,
                  displayName: email.subject || 'No Subject',
                  metadata: { from: email.from_email, date: email.received_at, mailbox: receivingAccount },
                })
              }
            >
              <div className="text-sm font-medium truncate">{email.subject || 'No Subject'}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{email.from_email}</span>
                {receivingAccount && (
                  <>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="truncate font-medium">{receivingAccount}</span>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DocumentBrowserPanel({ onSelect }: { onSelect: (att: PendingAttachment) => void }) {
  const [documents, setDocuments] = React.useState<DocumentResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async (query: string) => {
    setLoading(true);
    try {
      // Fetch from all non-email sources
      const params = new URLSearchParams({
        limit: '50',
        sources: 'corporate,user,job,contact,task'
      });
      if (query) params.append('search', query);

      const response = await api.get<{ documents?: DocumentResult[] } | DocumentResult[]>(
        `/api/v1/documents?${params}`
      );
      const docList = Array.isArray(response) ? response : response?.documents || [];
      setDocuments(docList);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  React.useEffect(() => {
    loadDocuments('');
  }, [loadDocuments]);

  // Debounced search-as-you-type
  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadDocuments(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadDocuments]);

  // Handle drag start for document
  const handleDragStart = (e: React.DragEvent, doc: DocumentResult) => {
    const uniqueId = `${doc.source_type}-${doc.id}`;
    setDraggingId(uniqueId);
    // Set document data for drop targets
    e.dataTransfer.setData('application/x-document-id', doc.id.toString());
    e.dataTransfer.setData('application/x-document-source', doc.source_type);
    e.dataTransfer.setData('application/x-document-name', doc.display_title || doc.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          placeholder="Search all documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm pr-8"
        />
        {loading ? (
          <Spinner size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Drag documents to questions or click to attach
      </p>
      <div className="max-h-[320px] overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner size={24} className="text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? 'No documents found' : 'Search for documents by name'}
          </p>
        ) : (
          documents.map((doc) => {
            const uniqueId = `${doc.source_type}-${doc.id}`;
            const sourceConfig = SOURCE_CONFIG[doc.source_type] || SOURCE_CONFIG.corporate;
            const SourceIcon = sourceConfig.icon;
            const isDragging = draggingId === uniqueId;

            return (
              <Card
                key={uniqueId}
                draggable
                onDragStart={(e) => handleDragStart(e, doc)}
                onDragEnd={handleDragEnd}
                className={`p-2 cursor-grab hover:bg-accent transition-colors group ${
                  isDragging ? 'opacity-50 ring-2 ring-primary' : ''
                }`}
                onClick={() =>
                  onSelect({
                    type: 'document',
                    id: doc.id,
                    displayName: doc.display_title || doc.name,
                    metadata: {
                      type: doc.document_type?.name,
                      url: doc.url || doc.file_url,
                      source_type: doc.source_type
                    },
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  <SourceIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {doc.display_title || doc.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${sourceConfig.color}`}>
                        {sourceConfig.label}
                      </span>
                      {doc.document_type && (
                        <span className="text-xs text-muted-foreground">{doc.document_type.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function FileUploadPanel({ onSelect }: { onSelect: (att: PendingAttachment) => void }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      onSelect({
        type: 'upload',
        file: file,
        displayName: file.name,
        metadata: { size: file.size, type: file.type },
      });
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isDragging
          ? 'border-primary bg-primary/10 dark:bg-primary/20'
          : 'dark:border-border'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        id="task-file-upload"
      />
      <label htmlFor="task-file-upload" className="cursor-pointer block">
        <Upload className={`h-6 w-6 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className={`text-sm ${isDragging ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
          {isDragging ? 'Drop files here' : 'Drag files here or click to upload'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Any file type supported</p>
      </label>
    </div>
  );
}
