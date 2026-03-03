"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { TabbedPage } from "@/components/ui/page-wrappers";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";

export default function TrainingPage() {
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab: /training/all, /training/required, /training/completed
  const activeTab = React.useMemo(() => {
    const parts = (pathname ?? "").replace("/training", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  // Redirect to default tab if none specified
  React.useEffect(() => {
    if (activeTab === null) {
      router.replace("/training/all", { scroll: false });
    }
  }, [activeTab, router]);

  const setActiveTab = React.useCallback((tab: string) => {
    router.push(`/training/${tab}`, { scroll: false });
  }, [router]);

  return (
    <TabbedPage
      title="Training Center"
      description="Courses and resources to help you get the most out of Teeem"
    >
      <Tabs expandKey="training-tabs" value={activeTab || "all"} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Modules</TabsTrigger>
          <TabsTrigger value="required">Required</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">Training modules coming soon</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                We&apos;re building interactive training courses to help your team get the most out of Teeem. Check back soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="required" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Required modules will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in-progress" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Modules you&apos;ve started will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Completed modules will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabbedPage>
  );
}
