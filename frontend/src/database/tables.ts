export const dbSchema = {
  notes: "_id, updatedAt, folder",
  folders: "_id",
  syncQueue: "++id, entity, entityId, timestamp",
  conflictLog: "++id, entity, entityId, timestamp",
};