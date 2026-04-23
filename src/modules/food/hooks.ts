/**
 * Food module hooks — React Query wrappers for FoodPod data.
 * Follows repo architecture: no direct fetch calls; all via src/services/food.service.ts
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PodData } from '@/services/food.service';
import { getPod, uploadImage } from '@/services/food.service';
import { DEMO_POD_ID } from './constants';

export const FOOD_POD_KEY = ['pod', DEMO_POD_ID] as const;

/**
 * usePod — polls the demo pod, faster when generating.
 */
export function usePod(): {
  pod: PodData | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: FOOD_POD_KEY,
    queryFn: () => getPod(DEMO_POD_ID),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'generating') return 3000;
      return 10000;
    },
    retry: 2,
  });
  return {
    pod: data,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * useUploadImage — optimistic increment on capturedCount, rollback on error.
 */
export function useUploadImage(): ReturnType<
  typeof useMutation<void, Error, { podId: string; uri: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ podId, uri }: { podId: string; uri: string }) => uploadImage(podId, uri),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: FOOD_POD_KEY });
      const previous = queryClient.getQueryData<PodData>(FOOD_POD_KEY);
      if (previous) {
        queryClient.setQueryData<PodData>(FOOD_POD_KEY, {
          ...previous,
          capturedCount: previous.capturedCount + 1,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: PodData } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData<PodData>(FOOD_POD_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FOOD_POD_KEY });
    },
  });
}
