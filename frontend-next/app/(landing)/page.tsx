 
"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { GanttUnified } from "@/components/gantt";
import type { GanttTask, GanttDependency } from "@/lib/gantt/types";
import { addDays, startOfWeek } from "date-fns";
import {
  Calendar,
  FileText,
  Users,
  BarChart3,
  Shield,
  Clock,
  Building2,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  Receipt,
  GanttChart as GanttIcon,
  HardHat,
  Sparkles,
  Zap,
  Brain,
  FileSearch,
  MessageSquareText,
  Wand2,
  Play,
  ChevronRight,
  MousePointerClick,
  FileSpreadsheet,
  ClipboardList,
  Send,
  TrendingUp,
} from "lucide-react";

// Animation hook for scroll-triggered animations
function useInView(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
     
  }, []);

  return { ref, isInView };
}

// Animated counter component
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-3xl font-bold font-mono">
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

// Typewriter effect component
function TypewriterText({ text, delay = 50 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("");
  const { ref, isInView } = useInView();

  useEffect(() => {
    if (!isInView) return;

    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, delay);

    return () => clearInterval(timer);
  }, [isInView, text, delay]);

  return (
    <span ref={ref}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Floating animation component
function FloatingElement({ children, delay = 0, duration = 3 }: { children: React.ReactNode; delay?: number; duration?: number }) {
  return (
    <div
      className="animate-float"
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </div>
  );
}

// Workflow step component with animation
function WorkflowStep({
  step,
  title,
  description,
  icon: Icon,
  isActive,
  isLast
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
  isActive: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 relative">
      <div className="flex flex-col items-center">
        <div
          className={`w-12 h-12 flex items-center justify-center border-2 transition-all duration-500 ${
            isActive
              ? "bg-primary text-primary-foreground border-primary scale-110"
              : "bg-background text-muted-foreground border-border"
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {!isLast && (
          <div className={`w-0.5 h-16 transition-all duration-500 ${isActive ? "bg-primary" : "bg-border"}`} />
        )}
      </div>
      <div className={`pt-2 transition-all duration-500 ${isActive ? "opacity-100 translate-x-0" : "opacity-50 -translate-x-2"}`}>
        <div className="text-xs text-muted-foreground mb-1">Step {step}</div>
        <h3 className="text-sm font-medium mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  // Gantt chart demo data - using GanttTask format for Canvas
  const today = new Date();
  const projectStart = startOfWeek(today);

  const [demoTasks] = useState<GanttTask[]>([
    {
      id: "site-setup",
      name: "Site Setup",
      startDate: projectStart,
      endDate: addDays(projectStart, 2),
      status: "completed",
      progress: 100,
    },
    {
      id: "excavation",
      name: "Excavation",
      startDate: addDays(projectStart, 3),
      endDate: addDays(projectStart, 5),
      status: "completed",
      progress: 100,
      predecessorIds: ["site-setup"],
    },
    {
      id: "pour-slab",
      name: "Pour Concrete Slab",
      startDate: addDays(projectStart, 6),
      endDate: addDays(projectStart, 7),
      status: "completed",
      progress: 100,
      locked: "supplierConfirmed",
      predecessorIds: ["excavation"],
    },
    {
      id: "frame-external",
      name: "Frame External Walls",
      startDate: addDays(projectStart, 10),
      endDate: addDays(projectStart, 14),
      status: "started",
      progress: 60,
      predecessorIds: ["pour-slab"],
    },
    {
      id: "frame-internal",
      name: "Frame Internal Walls",
      startDate: addDays(projectStart, 15),
      endDate: addDays(projectStart, 18),
      status: "not_started",
      predecessorIds: ["frame-external"],
    },
    {
      id: "roof-trusses",
      name: "Roof Trusses",
      startDate: addDays(projectStart, 19),
      endDate: addDays(projectStart, 21),
      status: "not_started",
      locked: "supplierConfirmed",
      predecessorIds: ["frame-internal"],
    },
  ]);

  const demoDependencies: GanttDependency[] = [
    { id: "dep-1", fromId: "site-setup", toId: "excavation", type: "FS" },
    { id: "dep-2", fromId: "excavation", toId: "pour-slab", type: "FS" },
    { id: "dep-3", fromId: "pour-slab", toId: "frame-external", type: "FS" },
    { id: "dep-4", fromId: "frame-external", toId: "frame-internal", type: "FS" },
    { id: "dep-5", fromId: "frame-internal", toId: "roof-trusses", type: "FS" },
  ];

  const features = [
    {
      icon: Briefcase,
      title: "Job Management",
      description: "Track every project from quote to completion. Organize tasks, timelines, and team assignments in one place."
    },
    {
      icon: GanttIcon,
      title: "Gantt Scheduling",
      description: "Visual project timelines with drag-and-drop scheduling. Set dependencies and track critical paths."
    },
    {
      icon: Receipt,
      title: "Estimates & Invoices",
      description: "Create professional quotes and invoices. Track payments and maintain financial clarity."
    },
    {
      icon: FileText,
      title: "Purchase Orders",
      description: "Streamline procurement with digital POs. Track supplier orders and delivery schedules."
    },
    {
      icon: Users,
      title: "Contact Management",
      description: "Centralize client and supplier information. Maintain relationships and communication history."
    },
    {
      icon: HardHat,
      title: "WHS Compliance",
      description: "Workplace health and safety documentation. Keep your team safe and compliant."
    },
    {
      icon: Calendar,
      title: "Meeting Scheduler",
      description: "Coordinate site visits and team meetings. Sync with your calendar for seamless scheduling."
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Real-time insights into project performance. Track KPIs and make data-driven decisions."
    }
  ];

  const aiFeatures = [
    {
      icon: FileSearch,
      title: "AI Estimate Review",
      description: "Automatically analyze supplier estimates for discrepancies, missing items, and pricing anomalies.",
      status: "Live"
    },
    {
      icon: MessageSquareText,
      title: "Smart Document Parsing",
      description: "Extract line items, quantities, and pricing from uploaded PDFs and spreadsheets automatically.",
      status: "Live"
    },
    {
      icon: Wand2,
      title: "Auto-Schedule Optimization",
      description: "AI suggests optimal task sequencing based on dependencies, resource availability, and weather forecasts.",
      status: "Coming Soon"
    },
    {
      icon: Brain,
      title: "Predictive Delays",
      description: "Machine learning models predict potential delays before they happen, based on historical project data.",
      status: "Coming Soon"
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Save Time",
      description: "Automate administrative tasks and focus on what matters - building."
    },
    {
      icon: Shield,
      title: "Stay Compliant",
      description: "Built-in WHS tools and documentation keep you audit-ready."
    },
    {
      icon: Building2,
      title: "Scale Confidently",
      description: "From solo tradies to large teams, grow without outgrowing your tools."
    }
  ];

  // Workflow steps
  const workflowSteps = [
    {
      icon: FileSpreadsheet,
      title: "Upload Estimates",
      description: "Import supplier quotes or create estimates from scratch"
    },
    {
      icon: ClipboardList,
      title: "Generate POs",
      description: "Convert approved estimates into purchase orders instantly"
    },
    {
      icon: GanttIcon,
      title: "Schedule Work",
      description: "Drag tasks onto the timeline and set dependencies"
    },
    {
      icon: Receipt,
      title: "Invoice & Get Paid",
      description: "Generate invoices and sync to Xero automatically"
    }
  ];

  // Workflow animation state
  const [activeStep, setActiveStep] = useState(0);
  const workflowRef = useInView();

  useEffect(() => {
    if (!workflowRef.isInView) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % workflowSteps.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [workflowRef.isInView, workflowSteps.length]);

  // Animation refs
  const { ref: heroRef, isInView: heroIsInView } = useInView();
  const { ref: ganttRef, isInView: ganttIsInView } = useInView();
  const { ref: aiRef, isInView: aiIsInView } = useInView();
  const { ref: invoiceRef, isInView: invoiceIsInView } = useInView();
  const { ref: featuresRef, isInView: featuresIsInView } = useInView();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                t
              </div>
              <span className="text-xl font-bold tracking-tight font-serif">Teeem</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#gantt" className="text-muted-foreground hover:text-foreground transition-colors">Scheduling</a>
              <a href="#ai" className="text-muted-foreground hover:text-foreground transition-colors">AI</a>
              <a href="#documents" className="text-muted-foreground hover:text-foreground transition-colors">Documents</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden relative">
        {/* Floating background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingElement delay={0} duration={4}>
            <div className="absolute top-20 left-[10%] w-16 h-16 bg-primary/5 border border-primary/10" />
          </FloatingElement>
          <FloatingElement delay={1} duration={5}>
            <div className="absolute top-40 right-[15%] w-12 h-12 bg-status-success/10 border border-status-success/20" />
          </FloatingElement>
          <FloatingElement delay={2} duration={3.5}>
            <div className="absolute bottom-32 left-[20%] w-8 h-8 bg-status-info/10 border border-status-info/20" />
          </FloatingElement>
          <FloatingElement delay={0.5} duration={4.5}>
            <div className="absolute bottom-20 right-[25%] w-20 h-20 bg-secondary border border-border" />
          </FloatingElement>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div
            ref={heroRef}
            className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${
              heroIsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-sm mb-8">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Built for Australian construction businesses</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-serif mb-6">
              Project management that builds with you
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              From estimates to invoices, scheduling to safety — Teeem brings everything together so you can focus on delivering exceptional projects.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto px-8 group">
                  Start free trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 group">
                  <Play className="mr-2 h-4 w-4" />
                  See it in action
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof with Animated Counters */}
      <section className="py-12 border-y bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <AnimatedCounter value={500} suffix="+" />
              <div className="text-sm text-muted-foreground mt-1">Active projects</div>
            </div>
            <div>
              <AnimatedCounter value={12} prefix="$" suffix="M+" />
              <div className="text-sm text-muted-foreground mt-1">Invoices processed</div>
            </div>
            <div>
              <AnimatedCounter value={150} suffix="+" />
              <div className="text-sm text-muted-foreground mt-1">Construction teams</div>
            </div>
            <div>
              <AnimatedCounter value={99} suffix=".9%" />
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Animated Workflow */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div
            ref={workflowRef.ref}
            className={`transition-all duration-1000 ${
              workflowRef.isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-sm mb-4">
                <TrendingUp className="w-4 h-4" />
                <span>Simple Workflow</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-4">
                From quote to cash in 4 steps
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Streamline your entire project lifecycle. No more spreadsheets, no more chaos.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Workflow Steps */}
              <div className="space-y-2">
                {workflowSteps.map((step, index) => (
                  <WorkflowStep
                    key={index}
                    step={index + 1}
                    title={step.title}
                    description={step.description}
                    icon={step.icon}
                    isActive={index <= activeStep}
                    isLast={index === workflowSteps.length - 1}
                  />
                ))}
              </div>

              {/* Animated Preview */}
              <div className="relative">
                <Card className="p-6 shadow-xl overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${((activeStep + 1) / workflowSteps.length) * 100}%` }}
                    />
                  </div>
                  <div className="pt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center">
                        {React.createElement(workflowSteps[activeStep].icon, { className: "w-5 h-5" })}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Step {activeStep + 1} of 4</div>
                        <div className="font-medium">{workflowSteps[activeStep].title}</div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">
                      {workflowSteps[activeStep].description}
                    </p>

                    {/* Step-specific preview content */}
                    <div className="bg-secondary/50 p-4 min-h-[120px]">
                      {activeStep === 0 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between border-b border-border pb-2">
                            <span>Timber Supply Co.</span>
                            <span className="font-mono">$12,450.00</span>
                          </div>
                          <div className="flex justify-between border-b border-border pb-2">
                            <span>Steel Frames Ltd.</span>
                            <span className="font-mono">$8,200.00</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>3 more estimates...</span>
                          </div>
                        </div>
                      )}
                      {activeStep === 1 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-status-success-foreground">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>PO-2024-0089 generated</span>
                          </div>
                          <div className="flex items-center gap-2 text-status-success-foreground">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>PO-2024-0090 generated</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Send className="w-4 h-4" />
                            <span>Sent to suppliers</span>
                          </div>
                        </div>
                      )}
                      {activeStep === 2 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span>Frame External</span>
                            <span className="text-xs bg-status-info text-status-info-foreground px-2 py-0.5">In Progress</span>
                          </div>
                          <div className="h-2 bg-secondary">
                            <div className="h-full bg-status-info w-3/4" />
                          </div>
                          <div className="text-xs text-muted-foreground">75% complete • 2 days remaining</div>
                        </div>
                      )}
                      {activeStep === 3 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between font-medium">
                            <span>Invoice Total</span>
                            <span className="font-mono">$21,450.00</span>
                          </div>
                          <div className="flex items-center gap-2 text-status-success-foreground">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Synced to Xero</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Payment due in 14 days</div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Gantt Chart Demo */}
      <section id="gantt" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <div
            ref={ganttRef}
            className={`transition-all duration-1000 ${
              ganttIsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-sm mb-4">
                <MousePointerClick className="w-4 h-4" />
                <span>Interactive Demo</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-4">
                Powerful Gantt scheduling
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Drag tasks, set dependencies, and watch your timeline update in real-time.
                Try it yourself — this is a live, interactive demo.
              </p>
            </div>

            <Card className="p-0 overflow-hidden border-2 shadow-2xl">
              <div className="bg-card border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="text-sm font-medium">Residential Build — 42 Smith Street</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-status-success" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-status-info" />
                    In Progress
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-secondary" />
                    Not Started
                  </span>
                </div>
              </div>
              <div className="h-[400px]">
                <GanttUnified
                  tasks={demoTasks}
                  dependencies={demoDependencies}
                  showToolbar={false}
                  className="h-full"
                />
              </div>
            </Card>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3 p-4 bg-card border">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Drag & Drop</h3>
                  <p className="text-xs text-muted-foreground mt-1">Drag tasks to reschedule. Dependencies auto-cascade.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-card border">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Supplier Locks</h3>
                  <p className="text-xs text-muted-foreground mt-1">Lock dates when suppliers confirm. Prevent accidental changes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-card border">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GanttIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Milestone Markers</h3>
                  <p className="text-xs text-muted-foreground mt-1">Track inspections, completions, and key dates visually.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="ai" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div
            ref={aiRef}
            className={`transition-all duration-1000 ${
              aiIsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-status-info/30 text-sm mb-4">
                <Brain className="w-4 h-4 text-accent-blue" />
                <span className="text-accent-blue font-medium">
                  AI-Powered
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-4">
                Intelligence built in
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Let AI handle the tedious work. From reviewing estimates to parsing documents,
                Teeem's AI features save hours every week.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aiFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className={`group hover:border-primary/50 transition-all duration-300 ${
                    feature.status === "Coming Soon" ? "opacity-75" : ""
                  }`}
                  style={{
                    transitionDelay: `${index * 100}ms`,
                    transform: aiIsInView ? "translateY(0)" : "translateY(20px)",
                    opacity: aiIsInView ? 1 : 0
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-status-info/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-6 h-6 text-accent-blue" />
                      </div>
                      <span className={`text-xs px-2 py-1 ${
                        feature.status === "Live"
                          ? "bg-status-success text-status-success-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {feature.status}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Demo Animation */}
            <div className="mt-12 p-8 bg-card border">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-accent-blue animate-pulse" />
                <span className="text-sm font-medium">AI Estimate Review in action</span>
              </div>
              <div className="bg-secondary/50 p-6 font-mono text-sm">
                <div className="text-muted-foreground mb-2">Analyzing estimate from "ABC Suppliers"...</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-status-warning-foreground">
                    <ChevronRight className="w-4 h-4" />
                    <TypewriterText text="Warning: Timber price 15% above market average" delay={30} />
                  </div>
                  <div className="flex items-center gap-2 text-status-error-foreground">
                    <ChevronRight className="w-4 h-4" />
                    <span>Missing item: Flashing (required for roofing stage)</span>
                  </div>
                  <div className="flex items-center gap-2 text-status-success-foreground">
                    <ChevronRight className="w-4 h-4" />
                    <span>Concrete pricing competitive - $12/m3 below average</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time Profit Tracking Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Live Dashboard Preview */}
            <div className="order-2 lg:order-1">
              <Card className="p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-medium">Project Profitability</h3>
                  <span className="text-xs bg-status-success text-status-success-foreground px-2 py-1">Live</span>
                </div>

                {/* Profit Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-secondary/50 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Contract Value</div>
                    <div className="text-xl font-bold font-mono">$285,000</div>
                  </div>
                  <div className="bg-secondary/50 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Costs to Date</div>
                    <div className="text-xl font-bold font-mono">$142,350</div>
                  </div>
                  <div className="bg-status-success/20 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Profit Margin</div>
                    <div className="text-xl font-bold font-mono text-status-success-foreground">24.8%</div>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="space-y-3 mb-6">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Breakdown</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Materials</span>
                      <span className="font-mono">$89,200</span>
                    </div>
                    <div className="h-2 bg-secondary">
                      <div className="h-full bg-primary" style={{ width: "63%" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Labour</span>
                      <span className="font-mono">$42,150</span>
                    </div>
                    <div className="h-2 bg-secondary">
                      <div className="h-full bg-status-info" style={{ width: "30%" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Subcontractors</span>
                      <span className="font-mono">$11,000</span>
                    </div>
                    <div className="h-2 bg-secondary">
                      <div className="h-full bg-status-warning" style={{ width: "7%" }} />
                    </div>
                  </div>
                </div>

                {/* Pricebook Alert */}
                <div className="bg-status-info/10 border border-status-info/20 p-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-medium">Pricebook updated:</span>
                      <span className="text-muted-foreground"> Timber prices increased 8% this week. Your margin is protected.</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-status-success/20 text-status-success-foreground text-sm mb-4">
                <BarChart3 className="w-4 h-4" />
                <span>Real-time Financials</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-6">
                Know your profit on every job
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Real-time pricebooks keep your estimates accurate. Track costs as they happen and always know exactly where you stand financially.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                  <span>Live pricebook with supplier pricing</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                  <span>Automatic margin calculations</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                  <span>Cost tracking per job stage</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                  <span>Price change alerts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Document Generation Section */}
      <section id="documents" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div
            ref={invoiceRef}
            className={`transition-all duration-1000 ${
              invoiceIsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-sm mb-4">
                  <FileText className="w-4 h-4" />
                  <span>Professional Documents</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-6">
                  Beautiful documents, zero effort
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Generate professional invoices, quotes, and purchase orders with one click.
                  Your branding, your style — automatically formatted and ready to send.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                    <span>Customizable templates with your logo</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                    <span>Automatic tax calculations (GST, VAT)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                    <span>PDF export and email integration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-status-success-foreground" />
                    <span>Xero sync for seamless accounting</span>
                  </div>
                </div>
              </div>

              {/* Invoice Preview */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 transform rotate-3" />
                <Card className="relative p-6 shadow-2xl transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                  <div className="border-b pb-4 mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mb-2">
                          t
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Your Company Pty Ltd<br />
                          123 Builder Street<br />
                          Sydney NSW 2000
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold font-serif">INVOICE</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          #INV-2024-0042<br />
                          Date: 27 Nov 2024
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span>Frame External Walls</span>
                      <span className="font-mono">$8,500.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Frame Internal Walls</span>
                      <span className="font-mono">$4,200.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Roof Trusses Installation</span>
                      <span className="font-mono">$6,800.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">$19,500.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-muted-foreground">
                      <span>GST (10%)</span>
                      <span className="font-mono">$1,950.00</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold text-lg">
                      <span>Total</span>
                      <span className="font-mono">$21,450.00</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <div
            ref={featuresRef}
            className={`transition-all duration-1000 ${
              featuresIsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-4">
                Everything you need to run your business
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Purpose-built tools for construction professionals. No bloat, no complexity — just what works.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="bg-card hover:bg-card/80 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1"
                  style={{
                    transitionDelay: featuresIsInView ? `${index * 75}ms` : "0ms",
                    transform: featuresIsInView ? "translateY(0)" : "translateY(20px)",
                    opacity: featuresIsInView ? 1 : 0
                  }}
                >
                  <CardHeader>
                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-6">
                Built by builders, for builders
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We understand the chaos of managing construction projects. That's why we built Teeem — to bring order to the job site and the office.
              </p>
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex gap-4 group">
                    <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <benefit.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Xero Integration</p>
                    <p className="text-sm text-muted-foreground">Sync invoices and expenses automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Microsoft 365</p>
                    <p className="text-sm text-muted-foreground">Sign in and sync your calendar</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Document Generation</p>
                    <p className="text-sm text-muted-foreground">Professional PDFs for quotes, invoices, and POs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Easy on the eyes, day or night</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Mobile Responsive</p>
                    <p className="text-sm text-muted-foreground">Access from anywhere, on any device</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif mb-6">
            Ready to streamline your projects?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join construction teams across Australia who trust Teeem to manage their business. Start your free trial today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto px-8 group">
                Get started for free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                t
              </div>
              <span className="text-xl font-bold tracking-tight font-serif">Teeem</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Project management for construction
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-foreground transition-colors">
                Sign up
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Teeem. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
