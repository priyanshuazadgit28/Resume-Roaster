import { apiClient } from "./client";

export const resumesApi = {
  upload: async (file, title) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);

    const res = await apiClient.post("/resumes", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  list: async () => ({ resumes: (await apiClient.get("/resumes")).data }),

  get: async (id) => (await apiClient.get(`/resumes/${id}`)).data,

  getVersion: async (id, versionId) => ({
    version: (await apiClient.get(`/resumes/${id}/versions/${versionId}`)).data,
  }),

  remove: async (id) => (await apiClient.delete(`/resumes/${id}`)).data,

  analyze: async (id, data) => {
    const raw = (await apiClient.post(`/resumes/${id}/analyze`, data)).data;
    raw.versionId = raw.version;
    return { analysis: raw };
  },

  analyses: async (id) => ({
    analyses: (await apiClient.get(`/resumes/${id}/analyses`)).data,
  }),

  analysisForVersion: async (id, versionId) => ({
    analysis: (await apiClient.get(`/resumes/${id}/versions/${versionId}/analysis`)).data,
  }),

  rewrite: async (id, data) =>
    (await apiClient.post(`/resumes/${id}/rewrite`, data)).data,

  diff: async (id, fromVersionId, toVersionId, mode = "word") =>
    (
      await apiClient.get(
        `/resumes/${id}/diff?from=${fromVersionId}&to=${toVersionId}&mode=${mode}`
      )
    ).data,
};
