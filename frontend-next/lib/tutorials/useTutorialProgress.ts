"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TutorialProgress } from "./tutorial-types";

interface TutorialProgressResponse {
  success: boolean;
  data: TutorialProgress;
}

const QUERY_KEY = ["tutorial-progress"];

export function useTutorialProgress() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<TutorialProgressResponse>("/api/v1/tutorial/progress");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const completeChapter = useMutation({
    mutationFn: async (chapterId: string) => {
      const response = await api.put<TutorialProgressResponse>("/api/v1/tutorial/progress", {
        complete_chapter: chapterId,
      });
      return response.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(QUERY_KEY, newData);
    },
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const response = await api.put<TutorialProgressResponse>("/api/v1/tutorial/progress", {
        dismissed: true,
      });
      return response.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(QUERY_KEY, newData);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const response = await api.post<TutorialProgressResponse>("/api/v1/tutorial/reset");
      return response.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(QUERY_KEY, newData);
    },
  });

  return {
    progress: data ?? { dismissed: false, completed_chapters: [], completed_at: null },
    isLoading,
    completeChapter: completeChapter.mutate,
    dismiss: dismiss.mutate,
    reset: reset.mutate,
    isCompleting: completeChapter.isPending,
  };
}
