import api from "@/lib/api";

export const getFolders = async () => {
    return api.get('/folders');
}

export const createFolder = async (data: {_id?: string; name: string; color?: string }) => {
    return api.post('/folders', data);
}

export const updateFolder = async (id: string, updates: any, version: number) => {
    return api.put(`/folders/${id}`, { ...updates, version });
}

export const deleteFolder = async (id: string, version: number) => {
    return api.delete(`/folders/${id}`, { data: { version } });
}
