import { apiClient } from "./client";

export const dashboardApi = {
  get: async () => (await apiClient.get("/dashboard")).data,
};
