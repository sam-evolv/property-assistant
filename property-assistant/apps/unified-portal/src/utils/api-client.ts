export async function apiGet(path: string) {
  const res = await fetch(path, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiPost(path: string, data?: any) {
  const res = await fetch(path, {
    method: "POST",
    headers: data instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: data instanceof FormData ? data : JSON.stringify(data || {}),
  });

  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}

export const api = {
  uploadTraining(formData: FormData) {
    return apiPost("/api/train", formData);
  },
  chat(payload: any) {
    return apiPost("/api/chat", payload);
  },
  getDevelopment(id: string) {
    return apiGet(`/api/developments/${id}`);
  },
  getDevelopments() {
    return apiGet("/api/developments");
  },
  importHouses(formData: FormData) {
    return apiPost("/api/houses/import", formData);
  },
};
