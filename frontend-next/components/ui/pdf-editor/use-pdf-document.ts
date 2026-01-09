"use client";

import * as React from "react";
import { PDFDocument } from "pdf-lib";
import { pdfjs } from "react-pdf";
import type { PDFPage } from "./types";
import { drawAnnotationsOnPage } from "./annotation-to-pdf";

// Set up PDF.js worker - use the version from react-pdf
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface UsePDFDocumentReturn {
  pages: PDFPage[];
  pdfDoc: PDFDocument | null;
  isLoading: boolean;
  error: string | null;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  deletePage: (pageId: string) => void;
  mergePDF: (file: File) => Promise<void>;
  exportPDF: () => Promise<Uint8Array>;
  updatePageAnnotations: (pageId: string, annotations: any[]) => void;
}

export function usePDFDocument(url: string): UsePDFDocumentReturn {
  const [pages, setPages] = React.useState<PDFPage[]>([]);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pdfBytesRef = React.useRef<Uint8Array | null>(null);

  // Load PDF and generate thumbnails
  React.useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch PDF bytes - include credentials for authenticated API endpoints
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/pdf',
          },
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Failed to fetch PDF: ${errorText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        pdfBytesRef.current = pdfBytes;

        // Load with pdf-lib for editing
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        setPdfDoc(doc);

        // Load with pdfjs for rendering thumbnails
        const loadingTask = pdfjs.getDocument({ data: pdfBytes });
        const pdfJsDoc = await loadingTask.promise;

        // Generate thumbnails for each page
        const pagePromises: Promise<PDFPage>[] = [];
        for (let i = 0; i < pdfJsDoc.numPages; i++) {
          pagePromises.push(generatePageThumbnail(pdfJsDoc, i));
        }

        const loadedPages = await Promise.all(pagePromises);
        setPages(loadedPages);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load PDF";
        // Don't log OneDrive credential errors - expected in local dev
        if (!errorMessage.includes("OneDrive credentials not available")) {
          console.error("Failed to load PDF:", err);
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (url) {
      loadPDF();
    }
  }, [url]);

  // Generate thumbnail for a single page
  const generatePageThumbnail = async (
    pdfJsDoc: pdfjs.PDFDocumentProxy,
    pageIndex: number
  ): Promise<PDFPage> => {
    const page = await pdfJsDoc.getPage(pageIndex + 1); // pdfjs uses 1-based indexing
    const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    return {
      id: `page-${pageIndex}-${Date.now()}`,
      pageIndex,
      thumbnail: canvas.toDataURL("image/png"),
      width: viewport.width,
      height: viewport.height,
      annotations: [],
    };
  };

  // Reorder pages
  const reorderPages = React.useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      const newPages = [...prev];
      const [moved] = newPages.splice(fromIndex, 1);
      newPages.splice(toIndex, 0, moved);
      // Update pageIndex for all pages
      return newPages.map((page, idx) => ({ ...page, pageIndex: idx }));
    });
  }, []);

  // Delete a page
  const deletePage = React.useCallback((pageId: string) => {
    setPages((prev) => {
      const newPages = prev.filter((p) => p.id !== pageId);
      // Update pageIndex for remaining pages
      return newPages.map((page, idx) => ({ ...page, pageIndex: idx }));
    });
  }, []);

  // Merge another PDF
  const mergePDF = React.useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mergeBytes = new Uint8Array(arrayBuffer);

      // Load merge PDF with pdfjs for thumbnails
      const loadingTask = pdfjs.getDocument({ data: mergeBytes });
      const mergePdfJs = await loadingTask.promise;

      // Generate thumbnails for merged pages
      const newPagePromises: Promise<PDFPage>[] = [];
      const startIndex = pages.length;
      for (let i = 0; i < mergePdfJs.numPages; i++) {
        newPagePromises.push(
          generatePageThumbnail(mergePdfJs, i).then((page) => ({
            ...page,
            id: `merged-${i}-${Date.now()}`,
            pageIndex: startIndex + i,
          }))
        );
      }

      const newPages = await Promise.all(newPagePromises);

      // Store merge bytes for export
      if (!pdfBytesRef.current) return;

      // Load merge doc with pdf-lib
      const mergeDoc = await PDFDocument.load(mergeBytes, { ignoreEncryption: true });

      // Copy pages to main doc
      if (pdfDoc) {
        const copiedPages = await pdfDoc.copyPages(mergeDoc, mergeDoc.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
      }

      setPages((prev) => [...prev, ...newPages]);
    } catch (err) {
      console.error("Failed to merge PDF:", err);
      throw err;
    }
  }, [pages.length, pdfDoc]);

  // Export the edited PDF with annotations embedded
  const exportPDF = React.useCallback(async (): Promise<Uint8Array> => {
    if (!pdfDoc || !pdfBytesRef.current) {
      throw new Error("No PDF loaded");
    }

    // Create a new document with pages in the current order
    const newDoc = await PDFDocument.create();

    // We need to reload from original bytes and reorder
    const originalDoc = await PDFDocument.load(pdfBytesRef.current, { ignoreEncryption: true });

    // Copy pages in the new order and draw annotations
    let newPageIndex = 0;
    for (const page of pages) {
      // Find original page index (before any reordering)
      const originalIndex = parseInt(page.id.split("-")[1]) || page.pageIndex;
      if (originalIndex < originalDoc.getPageCount()) {
        const [copiedPage] = await newDoc.copyPages(originalDoc, [originalIndex]);
        newDoc.addPage(copiedPage);

        // Draw annotations onto the copied page
        if (page.annotations && page.annotations.length > 0) {
          const pdfPage = newDoc.getPage(newPageIndex);
          // Page dimensions from thumbnail (at 0.3 scale) represent canvas coordinate space
          await drawAnnotationsOnPage(newDoc, pdfPage, page.annotations, {
            width: page.width,
            height: page.height,
          });
        }
        newPageIndex++;
      }
    }

    // Also copy any merged pages from pdfDoc that aren't in original
    if (pdfDoc.getPageCount() > originalDoc.getPageCount()) {
      const mergedIndices = [];
      for (let i = originalDoc.getPageCount(); i < pdfDoc.getPageCount(); i++) {
        mergedIndices.push(i);
      }
      if (mergedIndices.length > 0) {
        const mergedPages = await newDoc.copyPages(pdfDoc, mergedIndices);
        mergedPages.forEach((mergedPage) => {
          newDoc.addPage(mergedPage);
          // Find corresponding page data for annotations
          const pageData = pages.find(p => p.id.startsWith("merged-") && p.pageIndex === newPageIndex);
          if (pageData?.annotations && pageData.annotations.length > 0) {
            const pdfPage = newDoc.getPage(newPageIndex);
            drawAnnotationsOnPage(newDoc, pdfPage, pageData.annotations, {
              width: pageData.width,
              height: pageData.height,
            });
          }
          newPageIndex++;
        });
      }
    }

    return await newDoc.save();
  }, [pdfDoc, pages]);

  // Update annotations for a page
  const updatePageAnnotations = React.useCallback((pageId: string, annotations: any[]) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId ? { ...page, annotations } : page
      )
    );
  }, []);

  return {
    pages,
    pdfDoc,
    isLoading,
    error,
    reorderPages,
    deletePage,
    mergePDF,
    exportPDF,
    updatePageAnnotations,
  };
}
