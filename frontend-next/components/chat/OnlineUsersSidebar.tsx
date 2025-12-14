"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface OnlineUser {
  id: number;
  name: string;
  email: string;
  presence_status: "online" | "away" | "offline";
  is_online: boolean;
  last_seen_at: string | null;
}

interface OnlineUsersSidebarProps {
  onSelectUser?: (user: OnlineUser) => void;
  selectedUserId?: number;
  className?: string;
  compact?: boolean;
}

export function OnlineUsersSidebar({
  onSelectUser,
  selectedUserId,
  className,
  compact = false,
}: OnlineUsersSidebarProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOnlineUsers = async () => {
      setLoading(true);
      try {
        const response = await api.get<OnlineUser[]>("/api/v1/chat_messages/online_users");
        setOnlineUsers(response);
      } catch (error) {
        console.error("Failed to load online users:", error);
        setOnlineUsers([]);
      }
      setLoading(false);
    };
    loadOnlineUsers();

    // Refresh online users every 30 seconds
    const interval = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sort users: online first, then away, then offline
  const sortedOnlineUsers = [...onlineUsers].sort((a, b) => {
    const order = { online: 0, away: 1, offline: 2 };
    return order[a.presence_status] - order[b.presence_status];
  });

  const onlineCount = onlineUsers.filter((u) => u.is_online).length;

  if (compact) {
    return (
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader className="py-1 px-2 shrink-0">
          <CardTitle className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>Team ({onlineCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-1 pb-1 space-y-0.5">
              {loading ? (
                <div className="flex items-center justify-center py-2">
                  <Spinner />
                </div>
              ) : (
                sortedOnlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className={cn(
                      "flex items-center gap-1 p-1 rounded transition-colors",
                      onSelectUser && "cursor-pointer hover:bg-secondary",
                      selectedUserId === user.id && "bg-secondary"
                    )}
                    onClick={() => onSelectUser?.(user)}
                    title={`${user.name} - ${user.presence_status}`}
                  >
                    <div className="relative">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[8px]">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background",
                          user.presence_status === "online" && "bg-green-500",
                          user.presence_status === "away" && "bg-yellow-500",
                          user.presence_status === "offline" && "bg-gray-400"
                        )}
                      />
                    </div>
                    <span className="text-[10px] truncate flex-1">{user.name.split(' ')[0]}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team ({onlineCount} online)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="px-3 pb-3 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (
              sortedOnlineUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg transition-colors",
                    onSelectUser && "cursor-pointer hover:bg-secondary",
                    selectedUserId === user.id && "bg-secondary"
                  )}
                  onClick={() => onSelectUser?.(user)}
                  title={`Chat with ${user.name}`}
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
                        user.presence_status === "online" && "bg-green-500",
                        user.presence_status === "away" && "bg-yellow-500",
                        user.presence_status === "offline" && "bg-gray-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {user.presence_status}
                    </div>
                  </div>
                </div>
              ))
            )}
            {!loading && onlineUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No team members
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
