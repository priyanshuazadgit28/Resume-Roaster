import { apiClient } from "./client";

export const authApi = {
  register: async (data) => ({ user: (await apiClient.post("/auth/register", data)).data }),
  login: async (data) => ({ user: (await apiClient.post("/auth/login", data)).data }),
  logout: async () => (await apiClient.post("/auth/logout")).data,
  me: async () => ({ user: (await apiClient.get("/auth/me")).data }),
  updateProfile: async (data) => ({ user: (await apiClient.patch("/auth/profile", data)).data }),
  changePassword: async (data) => (await apiClient.patch("/auth/password", data)).data,
};
