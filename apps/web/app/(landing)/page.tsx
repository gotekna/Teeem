"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
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
  GanttChart,
  HardHat,
  Sparkles
} from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  const features = [
    {
      icon: Briefcase,
      title: "Job Management",
      description: "Track every project from quote to completion. Organize tasks, timelines, and team assignments in one place."
    },
    {
      icon: GanttChart,
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
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-sm mb-8">
              <Sparkles className="w-4 h-4" />
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
                <Button size="lg" className="w-full sm:w-auto px-8">
                  Start free trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                  Sign in to your account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold font-mono">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Active projects</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono">$12M+</div>
              <div className="text-sm text-muted-foreground mt-1">Invoices processed</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono">150+</div>
              <div className="text-sm text-muted-foreground mt-1">Construction teams</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono">99.9%</div>
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
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
              <Card key={index} className="bg-card hover:bg-card/80 transition-colors">
                <CardHeader>
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4">
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
                  <div key={index} className="flex gap-4">
                    <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Xero Integration</p>
                    <p className="text-sm text-muted-foreground">Sync invoices and expenses automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Microsoft 365</p>
                    <p className="text-sm text-muted-foreground">Sign in and sync your calendar</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Document Generation</p>
                    <p className="text-sm text-muted-foreground">Professional PDFs for quotes, invoices, and POs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Easy on the eyes, day or night</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
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
              <Button size="lg" className="w-full sm:w-auto px-8">
                Get started for free
                <ArrowRight className="ml-2 h-4 w-4" />
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
