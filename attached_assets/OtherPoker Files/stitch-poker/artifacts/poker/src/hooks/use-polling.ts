import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getGetGameStateQueryKey } from "@workspace/api-client-react";

/**
 * Custom hook to long-poll the game state for real-time poker action.
 * Simulates a WebSocket connection by actively refetching the specific table's state.
 */
export function useGamePolling(tableId: number | undefined, intervalMs = 1500) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!tableId) return;
    
    // Poll the game state endpoint aggressively to simulate real-time
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ 
        queryKey: getGetGameStateQueryKey(tableId) 
      });
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [tableId, queryClient, intervalMs]);
}
