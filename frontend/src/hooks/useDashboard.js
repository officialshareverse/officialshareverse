import { useQuery } from "@tanstack/react-query";
import API from "../api/axios";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => API.get("dashboard/").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
