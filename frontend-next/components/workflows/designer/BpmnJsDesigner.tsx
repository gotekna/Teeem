"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Save,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  Play,
  FileText,
  PenTool,
  Plus,
  Trash2,
  GripVertical,
  Users,
  Settings,
  Cog,
  UserCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { api, getApiBaseUrl } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";

// Default empty BPMN diagram
const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="186" y="203" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Workflow-level signing configuration
interface WorkflowSigningConfig {
  signers: SignerConfig[];
  signing_order: number; // 0 = parallel, 1+ = sequential
  expires_in_days: number;
  additional_documents?: AdditionalDocument[];
}

// Additional documents to include in signing package
interface AdditionalDocument {
  id: string;
  type: "template" | "attachment";
  template_key?: string; // For template type
  name?: string; // For display
}

interface BpmnJsDesignerProps {
  processId?: number;
  initialXml?: string;
  processName?: string;
  canvasData?: Record<string, unknown>; // Contains workflow signing config
  onSave?: (xml: string, svg: string, name: string, canvasData?: Record<string, unknown>) => Promise<void>;
  dataLoaded?: boolean; // True when parent has finished loading (even if xml is null)
}

interface SelectedElement {
  id: string;
  type: string;
  name?: string;
  businessObject?: Record<string, unknown>;
}

interface DocumentTemplate {
  key: string;
  name: string;
  category: string;
  layout: string;
  requires: string[];
}

interface Job {
  id: number;
  name: string;
  job_number?: string;
}

// Preview job with contacts for showing actual names/emails
interface JobContact {
  id: number;
  display_name: string;
  email: string;
  phone?: string;
}

interface PreviewJobData {
  job_id: number;
  job_name: string;
  primary_contact?: JobContact;
  secondary_contact?: JobContact;
  builder_representative?: JobContact;
}

// Task configuration types
type TaskType = "generate_document" | "generate_and_send_for_signing" | "attach_sharepoint_file" | "create_xero_invoice";
type ExecutionMode = "automatic" | "manual";

interface SignerConfig {
  id: string; // Local UUID for React keys
  contact_key?: string; // primary_contact, secondary_contact, builder, etc.
  name?: string;
  email?: string;
  role: string;
  signing_order?: number;
}

interface TaskConfig {
  task_type: TaskType;
  execution_mode: ExecutionMode; // automatic = runs without user action, manual = requires user action
  template_key?: string;
  signers?: SignerConfig[];
  signing_order?: number; // 0 = parallel, 1+ = sequential
  expires_in_days?: number;
  store_as_variable?: string;
  // For attach_sharepoint_file
  file_path?: string;
  file_name?: string;
  folder_name?: string;
  // For create_xero_invoice
  invoice_description?: string;
  invoice_amount?: number;
  claim_stage?: string; // deposit, frame, lock_up, etc.
}

// Contact key options for signers
const CONTACT_KEY_OPTIONS = [
  { id: "primary_contact", label: "Primary Contact (Client 1)" },
  { id: "secondary_contact", label: "Secondary Contact (Client 2)" },
  { id: "builder", label: "Builder Representative" },
  { id: "witness", label: "Witness" },
  { id: "guarantor", label: "Guarantor" },
  { id: "custom", label: "Custom (Enter Name/Email)" },
];

const SIGNER_ROLE_OPTIONS = [
  { id: "client", label: "Client" },
  { id: "builder", label: "Builder" },
  { id: "witness", label: "Witness" },
  { id: "guarantor", label: "Guarantor" },
  { id: "director", label: "Director" },
  { id: "partner", label: "Partner" },
];

// Default workflow signing config
const DEFAULT_SIGNING_CONFIG: WorkflowSigningConfig = {
  signers: [
    { id: "default-1", contact_key: "primary_contact", role: "client", signing_order: 1 },
    { id: "default-2", contact_key: "builder", role: "builder", signing_order: 2 },
  ],
  signing_order: 1, // Sequential by default
  expires_in_days: 30,
};

export default function BpmnJsDesigner({
  processId,
  initialXml,
  processName = "New Process",
  canvasData,
  onSave,
  dataLoaded = false,
}: BpmnJsDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelerRef = useRef<any>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editableName, setEditableName] = useState(processName || "New Workflow");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workflowSigningConfig, setWorkflowSigningConfig] = useState<WorkflowSigningConfig>(
    (canvasData?.signing_config as WorkflowSigningConfig) || DEFAULT_SIGNING_CONFIG
  );
  const [previewJobData, setPreviewJobData] = useState<PreviewJobData | null>(null);
  const [loadingJobContacts, setLoadingJobContacts] = useState(false);
  const { toast } = useToast();

  // Update editable name when prop changes (e.g., data loads from server)
  useEffect(() => {
    if (processName) {
      setEditableName(processName);
    }
  }, [processName]);

  // Prevent keyboard events in input fields from reaching BPMN canvas
  // This must be at document level with capture to run before bpmn-js handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" ||
                        target.tagName === "TEXTAREA" ||
                        target.tagName === "SELECT" ||
                        target.isContentEditable;

      // If typing in an editable field, stop bpmn-js from handling it
      if (isEditable) {
        e.stopImmediatePropagation();
      }
    };

    // Add at document level with capture - must be added before bpmn-js initializes
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Fetch Tekna document templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await api.get<{ success: boolean; data: DocumentTemplate[] }>(
          "/api/v1/tekna_documents/templates"
        );
        console.log("Templates response:", response);
        if (response?.success && response.data) {
          setTemplates(response.data);
          console.log("Loaded templates:", response.data.length);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  // Fetch jobs for test run - load all jobs so search works properly
  useEffect(() => {
    console.log("[BPMN] Starting to fetch jobs...");
    const fetchJobs = async () => {
      try {
        console.log("[BPMN] Calling /api/v1/jobs...");
        const response = await api.get<{ jobs: Job[]; pagination: object }>(
          "/api/v1/jobs?per_page=1000"
        );
        console.log("[BPMN] Jobs API response:", response);
        console.log("[BPMN] Jobs array:", response?.jobs);
        if (response?.jobs && Array.isArray(response.jobs)) {
          console.log("[BPMN] Setting", response.jobs.length, "jobs");
          setJobs(response.jobs);
        } else {
          console.warn("[BPMN] No jobs array in response. Keys:", Object.keys(response || {}));
        }
      } catch (err) {
        console.error("[BPMN] Failed to fetch jobs:", err);
      }
    };
    fetchJobs();
  }, []);

  // Fetch job contacts when a job is selected for preview
  useEffect(() => {
    if (!selectedJobId) {
      setPreviewJobData(null);
      return;
    }

    const fetchJobContacts = async () => {
      setLoadingJobContacts(true);
      try {
        const response = await api.get<{
          success?: boolean;
          id: number;
          name: string;
          primary_contact?: { id: number; display_name: string; email: string; phone?: string };
          secondary_contact?: { id: number; display_name: string; email: string; phone?: string };
          builder_representative?: { id: number; display_name: string; email: string; phone?: string };
        }>(`/api/v1/jobs/${selectedJobId}`);

        if (response) {
          setPreviewJobData({
            job_id: response.id,
            job_name: response.name,
            primary_contact: response.primary_contact,
            secondary_contact: response.secondary_contact,
            builder_representative: response.builder_representative,
          });
        }
      } catch (err) {
        console.error("Failed to fetch job contacts:", err);
        setPreviewJobData(null);
      } finally {
        setLoadingJobContacts(false);
      }
    };
    fetchJobContacts();
  }, [selectedJobId]);

  // Handle test run
  const handleTestRun = useCallback(async () => {
    if (!processId || !selectedJobId) {
      toast({
        title: "Cannot Test",
        description: "Please save the workflow and select a job first",
        variant: "destructive",
      });
      return;
    }

    setIsTestRunning(true);
    try {
      const response = await api.post<{ success: boolean; instance_id?: number; error?: string }>(
        `/api/v1/bpmn_processes/${processId}/test_run`,
        { job_id: selectedJobId }
      );

      if (response?.success) {
        toast({
          title: "Test Run Started",
          description: `Workflow instance #${response.instance_id} created for job`,
        });
      } else {
        throw new Error(response?.error || "Test run failed");
      }
    } catch (err) {
      console.error("Test run failed:", err);
      toast({
        title: "Test Run Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTestRunning(false);
    }
  }, [processId, selectedJobId, toast]);

  // Track initialization
  const initializedRef = useRef(false);
  const initCounterRef = useRef(0); // Track init attempts to handle StrictMode/races
  const xmlLoadedRef = useRef(false);

  // Initialize modeler ONCE (client-side only)
  useEffect(() => {
    const myInitId = ++initCounterRef.current;

    console.log("useEffect running:", {
      initId: myInitId,
      hasContainer: !!containerRef.current,
      initialized: initializedRef.current,
      processId,
      initialXmlLength: initialXml?.length
    });

    if (!containerRef.current || typeof window === "undefined") {
      console.log(`[${myInitId}] No container or SSR, skipping`);
      return;
    }
    if (initializedRef.current) {
      console.log(`[${myInitId}] Already initialized, skipping`);
      return;
    }

    // Wait for data to load if processId exists (editing existing workflow)
    // For new workflows (no processId), we can start immediately
    // dataLoaded tells us the query completed (even if xml is null)
    if (processId && !dataLoaded && !xmlLoadedRef.current) {
      console.log(`[${myInitId}] Waiting for data to load... (dataLoaded: ${dataLoaded})`);
      return; // Wait for query to complete
    }

    console.log(`[${myInitId}] Starting modeler initialization...`);
    xmlLoadedRef.current = true;

    let modeler: unknown = null;
    let aborted = false;

    const initModeler = async () => {
      console.log(`[${myInitId}] initModeler async starting...`);
      try {
        // Dynamic import for bpmn-js (browser only)
        const BpmnModeler = (await import("bpmn-js/lib/Modeler")).default;
        console.log(`[${myInitId}] BpmnModeler imported`);

        // Import CSS dynamically
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/diagram-js.css");
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/bpmn-js.css");
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css");
        console.log(`[${myInitId}] CSS imported`);

        // Check if this init attempt was superseded or aborted
        if (aborted || initCounterRef.current !== myInitId) {
          console.log(`[${myInitId}] Init superseded or aborted (current: ${initCounterRef.current})`);
          return;
        }

        // Check if already initialized by another attempt
        if (initializedRef.current) {
          console.log(`[${myInitId}] Already initialized by another attempt`);
          return;
        }

        console.log(`[${myInitId}] Creating modeler with container:`, containerRef.current);
        modeler = new BpmnModeler({
          container: containerRef.current!,
        });
        console.log(`[${myInitId}] Modeler created:`, modeler);

        modelerRef.current = modeler;

        // Load initial diagram
        const xmlToLoad = initialXml || EMPTY_BPMN;
        console.log(`[${myInitId}] Initializing modeler with XML length:`, xmlToLoad.length);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (modeler as any).importXML(xmlToLoad);
        console.log(`[${myInitId}] XML imported successfully`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvas = (modeler as any).get("canvas");
        canvas.zoom("fit-viewport");

        // Mark as fully initialized AFTER successful setup
        initializedRef.current = true;
        setIsLoaded(true);
        console.log(`[${myInitId}] Modeler loaded and ready`);

        // Listen for selection changes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventBus = (modeler as any).get("eventBus");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventBus.on("selection.changed", (e: any) => {
          const selection = e.newSelection;
          if (selection && selection.length === 1) {
            const element = selection[0];
            setSelectedElement({
              id: element.id,
              type: element.type,
              name: element.businessObject?.name,
              businessObject: element.businessObject,
            });
          } else {
            setSelectedElement(null);
          }
        });

        // Listen for changes to mark dirty
        eventBus.on("commandStack.changed", () => {
          setIsDirty(true);
        });
      } catch (err) {
        console.error("initModeler failed:", err);
        toast({
          title: "Error",
          description: "Failed to initialize diagram editor",
          variant: "destructive",
        });
      }
    };

    initModeler();

    // Cleanup
    return () => {
      console.log(`[${myInitId}] Cleanup running, modeler exists:`, !!modeler, "initialized:", initializedRef.current);
      aborted = true;
      if (modeler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (modeler as any).destroy();
        modelerRef.current = null;
        initializedRef.current = false;
      }
    };
  // Note: dataLoaded in deps so effect re-runs when data loads from parent query
  // The initCounterRef ensures only the latest init attempt succeeds
  }, [toast, initialXml, processId, dataLoaded]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!modelerRef.current || !onSave) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const { svg } = await modelerRef.current.saveSVG();

      // Include workflow signing config in canvas_data
      const updatedCanvasData = {
        ...canvasData,
        signing_config: workflowSigningConfig,
      };

      await onSave(xml || "", svg || "", editableName, updatedCanvasData);
      setIsDirty(false);

      toast({
        title: "Saved",
        description: "Workflow saved successfully",
      });
    } catch (err) {
      console.error("Failed to save:", err);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    }
  }, [onSave, toast, editableName, canvasData, workflowSigningConfig]);

  // Export BPMN XML
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml || ""], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${editableName}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  }, [editableName]);

  // Import BPMN XML
  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bpmn,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !modelerRef.current) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const xml = event.target?.result as string;
        try {
          await modelerRef.current?.importXML(xml);
          const canvas = modelerRef.current?.get("canvas");
          canvas.zoom("fit-viewport");
          setIsDirty(true);
          toast({
            title: "Imported",
            description: "BPMN diagram imported successfully",
          });
        } catch (err) {
          console.error("Failed to import:", err);
          toast({
            title: "Error",
            description: "Failed to import BPMN file",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [toast]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom * 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom * 0.8);
  }, []);

  const handleFitView = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    canvas.zoom("fit-viewport");
  }, []);

  // Update element name
  const handleNameChange = useCallback((newName: string) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get("modeling");
    const elementRegistry = modelerRef.current.get("elementRegistry");
    const element = elementRegistry.get(selectedElement.id);

    if (element) {
      modeling.updateProperties(element, { name: newName });
      setSelectedElement(prev => prev ? { ...prev, name: newName } : null);
    }
  }, [selectedElement]);


  // Get current task config from selected element
  const getTaskConfig = useCallback((): TaskConfig => {
    const defaultConfig: TaskConfig = { task_type: "generate_document", execution_mode: "manual" };
    if (!selectedElement?.businessObject) return defaultConfig;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bo = selectedElement.businessObject as any;
    const docs = bo.documentation;

    if (!docs) return defaultConfig;

    // Handle array of documentation elements (standard BPMN format)
    if (Array.isArray(docs) && docs.length > 0) {
      const textContent = docs[0].text || docs[0].body || docs[0];
      if (typeof textContent === "string") {
        try {
          const config = JSON.parse(textContent);
          // Ensure signers have IDs
          if (config.signers) {
            config.signers = config.signers.map((s: SignerConfig, i: number) => ({
              ...s,
              id: s.id || `signer-${i}-${Date.now()}`
            }));
          }
          return { ...defaultConfig, ...config };
        } catch {
          return defaultConfig;
        }
      }
    }

    // Handle direct object (from local state update)
    if (typeof docs === "object" && docs.task_type) {
      return { ...defaultConfig, ...docs };
    }

    // Handle JSON string
    if (typeof docs === "string") {
      try {
        const config = JSON.parse(docs);
        return { ...defaultConfig, ...config };
      } catch {
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [selectedElement]);

  // Update service task configuration
  const updateTaskConfig = useCallback((updates: Partial<TaskConfig>) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get("modeling");
    const moddle = modelerRef.current.get("moddle");
    const elementRegistry = modelerRef.current.get("elementRegistry");
    const element = elementRegistry.get(selectedElement.id);

    if (element) {
      const currentConfig = getTaskConfig();
      const newConfig = { ...currentConfig, ...updates };

      // Clean up signers for storage (remove local IDs)
      if (newConfig.signers) {
        newConfig.signers = newConfig.signers.map(({ id, ...rest }) => rest as SignerConfig);
      }

      const configJson = JSON.stringify(newConfig);

      // Create a documentation element using moddle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentation = (moddle as any).create("bpmn:Documentation", {
        text: configJson
      });

      // Update the element with the new documentation array
      modeling.updateProperties(element, {
        documentation: [documentation]
      });

      // Update local state to reflect the change
      setSelectedElement(prev => prev ? {
        ...prev,
        businessObject: { ...prev.businessObject, documentation: [{ text: configJson }] }
      } : null);

      setIsDirty(true);
    }
  }, [selectedElement, getTaskConfig]);

  // Add a signer
  const addSigner = useCallback(() => {
    const config = getTaskConfig();
    const signers = config.signers || [];
    const newSigner: SignerConfig = {
      id: `signer-${Date.now()}`,
      contact_key: "primary_contact",
      role: "client",
      signing_order: signers.length + 1
    };
    updateTaskConfig({ signers: [...signers, newSigner] });
  }, [getTaskConfig, updateTaskConfig]);

  // Remove a signer
  const removeSigner = useCallback((signerId: string) => {
    const config = getTaskConfig();
    const signers = (config.signers || []).filter(s => s.id !== signerId);
    // Reorder remaining signers
    signers.forEach((s, i) => { s.signing_order = i + 1; });
    updateTaskConfig({ signers });
  }, [getTaskConfig, updateTaskConfig]);

  // Update a specific signer
  const updateSigner = useCallback((signerId: string, updates: Partial<SignerConfig>) => {
    const config = getTaskConfig();
    const signers = (config.signers || []).map(s =>
      s.id === signerId ? { ...s, ...updates } : s
    );
    updateTaskConfig({ signers });
  }, [getTaskConfig, updateTaskConfig]);

  // Move signer up/down (task-level - deprecated, keeping for backwards compat)
  const moveSigner = useCallback((signerId: string, direction: "up" | "down") => {
    const config = getTaskConfig();
    const signers = [...(config.signers || [])];
    const idx = signers.findIndex(s => s.id === signerId);
    if (idx === -1) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= signers.length) return;

    // Swap
    [signers[idx], signers[newIdx]] = [signers[newIdx], signers[idx]];
    // Update signing order
    signers.forEach((s, i) => { s.signing_order = i + 1; });
    updateTaskConfig({ signers });
  }, [getTaskConfig, updateTaskConfig]);

  // ===== WORKFLOW-LEVEL SIGNER MANAGEMENT =====
  const addWorkflowSigner = useCallback(() => {
    const newSigner: SignerConfig = {
      id: `signer-${Date.now()}`,
      contact_key: "primary_contact",
      role: "client",
      signing_order: workflowSigningConfig.signers.length + 1
    };
    setWorkflowSigningConfig(prev => ({
      ...prev,
      signers: [...prev.signers, newSigner]
    }));
    setIsDirty(true);
  }, [workflowSigningConfig.signers.length]);

  const removeWorkflowSigner = useCallback((signerId: string) => {
    setWorkflowSigningConfig(prev => {
      const signers = prev.signers.filter(s => s.id !== signerId);
      signers.forEach((s, i) => { s.signing_order = i + 1; });
      return { ...prev, signers };
    });
    setIsDirty(true);
  }, []);

  const updateWorkflowSigner = useCallback((signerId: string, updates: Partial<SignerConfig>) => {
    setWorkflowSigningConfig(prev => ({
      ...prev,
      signers: prev.signers.map(s => s.id === signerId ? { ...s, ...updates } : s)
    }));
    setIsDirty(true);
  }, []);

  const moveWorkflowSigner = useCallback((signerId: string, direction: "up" | "down") => {
    setWorkflowSigningConfig(prev => {
      const signers = [...prev.signers];
      const idx = signers.findIndex(s => s.id === signerId);
      if (idx === -1) return prev;

      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= signers.length) return prev;

      [signers[idx], signers[newIdx]] = [signers[newIdx], signers[idx]];
      signers.forEach((s, i) => { s.signing_order = i + 1; });
      return { ...prev, signers };
    });
    setIsDirty(true);
  }, []);

  const updateWorkflowSigningOrder = useCallback((sequential: boolean) => {
    setWorkflowSigningConfig(prev => ({
      ...prev,
      signing_order: sequential ? 1 : 0
    }));
    setIsDirty(true);
  }, []);

  const updateWorkflowExpiry = useCallback((days: number) => {
    setWorkflowSigningConfig(prev => ({
      ...prev,
      expires_in_days: days
    }));
    setIsDirty(true);
  }, []);

  // ===== ADDITIONAL DOCUMENTS MANAGEMENT =====
  const addAdditionalDocument = useCallback((templateKey: string) => {
    const template = templates.find(t => t.key === templateKey);
    if (!template) return;

    const newDoc: AdditionalDocument = {
      id: `doc-${Date.now()}`,
      type: "template",
      template_key: templateKey,
      name: template.name,
    };
    setWorkflowSigningConfig(prev => ({
      ...prev,
      additional_documents: [...(prev.additional_documents || []), newDoc]
    }));
    setIsDirty(true);
  }, [templates]);

  const removeAdditionalDocument = useCallback((docId: string) => {
    setWorkflowSigningConfig(prev => ({
      ...prev,
      additional_documents: (prev.additional_documents || []).filter(d => d.id !== docId)
    }));
    setIsDirty(true);
  }, []);

  // Get contact details from preview job data based on contact_key
  const getContactDetails = useCallback((contactKey?: string): JobContact | null => {
    if (!previewJobData || !contactKey) return null;

    switch (contactKey) {
      case "primary_contact":
        return previewJobData.primary_contact || null;
      case "secondary_contact":
        return previewJobData.secondary_contact || null;
      case "builder":
        return previewJobData.builder_representative || null;
      default:
        return null;
    }
  }, [previewJobData]);

  // Open document preview in new tab
  const handlePreviewDocument = useCallback((templateKey: string) => {
    if (!selectedJobId || !templateKey) {
      toast({
        title: "Cannot Preview",
        description: "Select a job first to preview the document",
        variant: "destructive",
      });
      return;
    }
    window.open(`${getApiBaseUrl()}/api/v1/tekna_documents/preview?template_key=${templateKey}&job_id=${selectedJobId}`, "_blank");
  }, [selectedJobId, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <BackButton fallbackHref="/workflows" />

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex items-center gap-1">
          <Input
            value={editableName}
            onChange={(e) => {
              setEditableName(e.target.value);
              setIsDirty(true);
            }}
            className="text-sm font-medium h-8 w-48"
            placeholder="Workflow name..."
          />
          {isDirty && <span className="text-xs text-muted-foreground">(unsaved)</span>}
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleImport}>
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="outline" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleFitView}>
          <Maximize className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button onClick={handleSave} disabled={!isDirty}>
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>

        {/* Workflow Settings */}
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Workflow Settings</SheetTitle>
              <SheetDescription>
                Configure signing and document package settings for this workflow.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* E-Signature Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <PenTool className="h-4 w-4" />
                  E-Signature Settings
                </h4>

                {/* Signing Order Mode */}
                <div className="pl-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Signing Order</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Parallel</span>
                      <Switch
                        checked={workflowSigningConfig.signing_order > 0}
                        onCheckedChange={updateWorkflowSigningOrder}
                      />
                      <span className="text-xs text-muted-foreground">Sequential</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {workflowSigningConfig.signing_order === 0
                      ? "All signers can sign at the same time"
                      : "Signers must sign in order (1st, 2nd, 3rd...)"}
                  </p>

                  {/* Expiry */}
                  <div>
                    <Label className="text-sm">Signature Request Expires In</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={workflowSigningConfig.expires_in_days}
                        onChange={(e) => updateWorkflowExpiry(parseInt(e.target.value) || 30)}
                        min={1}
                        max={365}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signers List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Default Signers
                  </h4>
                  <Button variant="outline" size="sm" onClick={addWorkflowSigner}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Signer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  These signers will be used for all documents that require signing in this workflow.
                </p>

                {/* Job selector for previewing contacts */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-medium">Preview with Job</Label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a job to see contact details...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id.toString()}>
                        {job.job_number ? `${job.job_number} - ` : ""}{job.name}
                      </option>
                    ))}
                  </select>
                  {selectedJobId && previewJobData && (
                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span>✓</span> {previewJobData.job_name}
                    </div>
                  )}
                  {loadingJobContacts && (
                    <div className="text-xs text-muted-foreground">Loading contacts...</div>
                  )}
                </div>

                <div className="space-y-3">
                  {workflowSigningConfig.signers.map((signer, idx) => (
                    <div key={signer.id} className="border rounded-lg p-3 bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {workflowSigningConfig.signing_order > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              #{idx + 1}
                            </Badge>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {CONTACT_KEY_OPTIONS.find(o => o.id === signer.contact_key)?.label || "Custom Signer"}
                            </span>
                            {/* Show actual contact details if job is selected */}
                            {signer.contact_key && getContactDetails(signer.contact_key) && (
                              <span className="text-xs text-green-600">
                                {getContactDetails(signer.contact_key)?.display_name} - {getContactDetails(signer.contact_key)?.email}
                              </span>
                            )}
                            {signer.contact_key && !getContactDetails(signer.contact_key) && selectedJobId && !loadingJobContacts && (
                              <span className="text-xs text-orange-500">
                                Not set on selected job
                              </span>
                            )}
                            {signer.contact_key && loadingJobContacts && (
                              <span className="text-xs text-muted-foreground">
                                Loading...
                              </span>
                            )}
                            {signer.contact_key && !selectedJobId && (
                              <span className="text-xs text-muted-foreground">
                                Select a job to preview contacts
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {workflowSigningConfig.signing_order > 0 && idx > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveWorkflowSigner(signer.id, "up")}
                              title="Move up"
                            >
                              <GripVertical className="h-4 w-4 rotate-90" />
                            </Button>
                          )}
                          {workflowSigningConfig.signing_order > 0 && idx < workflowSigningConfig.signers.length - 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveWorkflowSigner(signer.id, "down")}
                              title="Move down"
                            >
                              <GripVertical className="h-4 w-4 -rotate-90" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeWorkflowSigner(signer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Contact Selection */}
                      <div>
                        <Label className="text-xs">Contact</Label>
                        <select
                          value={signer.contact_key || "custom"}
                          onChange={(e) => updateWorkflowSigner(signer.id, {
                            contact_key: e.target.value === "custom" ? undefined : e.target.value,
                            name: e.target.value === "custom" ? "" : undefined,
                            email: e.target.value === "custom" ? "" : undefined
                          })}
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {CONTACT_KEY_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom name/email if no contact_key */}
                      {!signer.contact_key && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={signer.name || ""}
                              onChange={(e) => updateWorkflowSigner(signer.id, { name: e.target.value })}
                              placeholder="Signer name..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email</Label>
                            <Input
                              value={signer.email || ""}
                              onChange={(e) => updateWorkflowSigner(signer.id, { email: e.target.value })}
                              placeholder="signer@email.com"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}

                      {/* Role */}
                      <div>
                        <Label className="text-xs">Role</Label>
                        <select
                          value={signer.role || "client"}
                          onChange={(e) => updateWorkflowSigner(signer.id, { role: e.target.value })}
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {SIGNER_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {workflowSigningConfig.signers.length === 0 && (
                    <div className="text-center py-6 border rounded-lg bg-muted/20">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No signers configured yet.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={addWorkflowSigner}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add First Signer
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Documents Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Package
                  </h4>
                  {workflowSigningConfig.additional_documents && workflowSigningConfig.additional_documents.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {workflowSigningConfig.additional_documents.length} doc{workflowSigningConfig.additional_documents.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add additional documents to include in the signing package (like plans, schedules, etc.)
                </p>

                {/* List of additional documents */}
                <div className="space-y-2">
                  {(workflowSigningConfig.additional_documents || []).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => doc.template_key && handlePreviewDocument(doc.template_key)}
                          disabled={!selectedJobId}
                          title={selectedJobId ? "Preview document" : "Select a job to preview"}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeAdditionalDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add document dropdown */}
                <div>
                  <Label className="text-xs">Add Document to Package</Label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addAdditionalDocument(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a document template...</option>
                    {templates
                      .filter(t => !(workflowSigningConfig.additional_documents || []).some(d => d.template_key === t.key))
                      .map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Test Run Section */}
        <ComboboxDropdown
          items={jobs.map((job) => ({
            id: job.id.toString(),
            label: `${job.job_number ? `${job.job_number} - ` : ""}${job.name}`,
          }))}
          selectedItem={selectedJobId ? { id: selectedJobId, label: jobs.find(j => j.id.toString() === selectedJobId)?.name || "" } : undefined}
          onSelect={(item) => setSelectedJobId(item.id)}
          placeholder="Select job to test..."
          searchPlaceholder="Search jobs..."
          emptyResults="No jobs found"
          className="min-w-[250px]"
        />

        <Button
          variant="default"
          onClick={handleTestRun}
          disabled={!processId || !selectedJobId || isTestRunning}
          title={!processId ? "Save workflow first" : !selectedJobId ? "Select a job" : isDirty ? "Has unsaved changes" : "Run workflow test"}
          className="bg-green-600 hover:bg-green-700"
        >
          {isTestRunning ? (
            <Spinner size={16} className="mr-1" />
          ) : (
            <Play className="w-4 h-4 mr-1" />
          )}
          Test Run
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* BPMN Canvas */}
        <div
          ref={containerRef}
          className="flex-1 bg-white"
          style={{ minHeight: "500px" }}
        />

        {/* Properties Panel */}
        <div className="w-80 border-l bg-background overflow-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-4">Properties</h3>

            {!isLoaded ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : selectedElement ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <div className="font-medium">{selectedElement.type.replace("bpmn:", "")}</div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">ID</Label>
                  <div className="font-mono text-xs">{selectedElement.id}</div>
                </div>

                <div>
                  <Label htmlFor="element-name">Name</Label>
                  <Input
                    id="element-name"
                    value={selectedElement.name || ""}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter name..."
                    className="mt-1"
                  />
                </div>

                {/* Execution Mode - show for Task or ServiceTask */}
                {(selectedElement.type === "bpmn:ServiceTask" || selectedElement.type === "bpmn:Task") && (() => {
                  const taskConfig = getTaskConfig();
                  const isAutomatic = taskConfig.execution_mode === "automatic";

                  return (
                    <div className="pt-4 border-t">
                      <Label className="text-sm font-medium mb-3 block">Execution Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateTaskConfig({ execution_mode: "automatic" })}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            isAutomatic
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/50"
                          }`}
                        >
                          <Cog className={`h-5 w-5 ${isAutomatic ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${isAutomatic ? "text-primary" : "text-muted-foreground"}`}>
                            Automatic
                          </span>
                        </button>
                        <button
                          onClick={() => updateTaskConfig({ execution_mode: "manual" })}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            !isAutomatic
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/50"
                          }`}
                        >
                          <UserCheck className={`h-5 w-5 ${!isAutomatic ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${!isAutomatic ? "text-primary" : "text-muted-foreground"}`}>
                            Manual
                          </span>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {isAutomatic
                          ? "Runs automatically without user action"
                          : "Requires user to click to complete"}
                      </p>
                    </div>
                  );
                })()}

                {/* Service Task Config - show for Task or ServiceTask */}
                {(selectedElement.type === "bpmn:ServiceTask" || selectedElement.type === "bpmn:Task") && (() => {
                  const taskConfig = getTaskConfig();
                  const selectedTemplate = templates.find(t => t.key === taskConfig.template_key);
                  const requiresSigning = taskConfig.task_type === "generate_and_send_for_signing";

                  return (
                    <div className="pt-4 border-t space-y-4">
                      {/* Document Template */}
                      <div>
                        <Label htmlFor="template-select">Document Template</Label>
                        <select
                          id="template-select"
                          value={taskConfig.template_key || ""}
                          onChange={(e) => updateTaskConfig({ template_key: e.target.value })}
                          className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select template...</option>
                          {templates.map((template) => (
                            <option key={template.key} value={template.key}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        {selectedTemplate && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              <FileText className="h-3 w-3 inline mr-1" />
                              {selectedTemplate.category} • {selectedTemplate.layout === "tekna" ? "Teeem Branded" : "QBCC Official"}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(`${getApiBaseUrl()}/api/v1/tekna_documents/${selectedTemplate.key}/preview?format=html`, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview Template
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Requires Signing Checkbox */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <PenTool className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="requires-signing" className="text-sm font-medium cursor-pointer">
                            Requires Signing
                          </Label>
                        </div>
                        <Switch
                          id="requires-signing"
                          checked={requiresSigning}
                          onCheckedChange={(checked) => updateTaskConfig({
                            task_type: checked ? "generate_and_send_for_signing" : "generate_document"
                          })}
                        />
                      </div>
                      {requiresSigning && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            This document will be sent for e-signature using the workflow&apos;s signing settings.
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <Users className="h-3 w-3" />
                            <span>{workflowSigningConfig.signers.length} signer{workflowSigningConfig.signers.length !== 1 ? "s" : ""}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{workflowSigningConfig.signing_order === 0 ? "Parallel" : "Sequential"}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{workflowSigningConfig.expires_in_days}d expiry</span>
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => setSettingsOpen(true)}
                          >
                            Edit signing settings →
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select an element to view its properties
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
