export const dbSchemaV1 = {
  notes: "_id, updatedAt, folder",
  folders: "_id",
  syncQueue: "++id, entity, entityId, timestamp",
  conflictLog: "++id, entity, entityId, timestamp",
};

export const dbSchemaV2 = {
  notes: "_id, updatedAt, folder, isConflicted",
  folders: "_id",
  syncQueue: "++id, entity, entityId, timestamp",
  conflictLog: "++id, entity, entityId, status, timestamp",
};

export const dbSchema = dbSchemaV2; 