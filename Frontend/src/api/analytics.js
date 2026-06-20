import { apiClient } from "./client";

export const analyticsApi = {
  insights: async () => (await apiClient.get("/insights")).data,
  versions: async () => (await apiClient.get("/versions")).data,
  history: async () => (await apiClient.get("/history")).data,
};
