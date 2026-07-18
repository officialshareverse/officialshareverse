import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API from "../api/axios";

export function useProfile(options) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => API.get("profile/").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    ...options,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.patch("profile/", data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["profile"], data);
      qc.invalidateQueries(["profile"]);
    },
  });
}
