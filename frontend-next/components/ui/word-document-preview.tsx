"use client";

import * as React from "react";
import mammoth from "mammoth";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";

interface WordDocumentPreviewProps {
  url: string;
  className?: string;
}

/**
 * Word Document Preview Component
 * Fetches a .docx file and renders it as HTML using mammoth
 */
export function WordDocumentPreview({ url, className }: WordDocumentPreviewProps) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      setHtml(null);

      try {
        // Fetch the document from the URL
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Convert to HTML using mammoth
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
              "p[style-name='Heading 5'] => h5:fresh",
              "p[style-name='Heading 6'] => h6:fresh",
              "p[style-name='Title'] => h1.title:fresh",
              "p[style-name='Subtitle'] => p.subtitle:fresh",
              "r[style-name='Strong'] => strong",
              "r[style-name='Emphasis'] => em",
            ],
            convertImage: mammoth.images.imgElement(async (image) => {
              const buffer = await image.read("base64");
              const contentType = image.contentType || "image/png";
              return {
                src: `data:${contentType};base64,${buffer}`,
              };
            }),
          }
        );

        if (!cancelled) {
          setHtml(result.value);
          if (result.messages.length > 0) {
            console.log("Word document conversion warnings:", result.messages);
          }
        }
      } catch (err) {
        console.error("Failed to load Word document:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto bg-white dark:bg-gray-950 ${className}`}>
      <div className="max-w-4xl mx-auto p-8">
        <div
          className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:font-semibold
            prose-h1:text-2xl prose-h1:mb-4
            prose-h2:text-xl prose-h2:mb-3
            prose-h3:text-lg prose-h3:mb-2
            prose-p:mb-3 prose-p:leading-relaxed
            prose-ul:mb-3 prose-ol:mb-3
            prose-table:border-collapse prose-table:w-full
            prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:p-2
            prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
            prose-img:max-w-full prose-img:h-auto
          "
          dangerouslySetInnerHTML={{ __html: html || "" }}
        />
      </div>
    </div>
  );
}
