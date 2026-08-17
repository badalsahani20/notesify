import * as FolderService from "../services/folder.service.js";
import catchAsync from "../utils/catchAsync.js";
import { redis } from "../../config/redis.js";

export const createFolder = catchAsync(async (req, res) => {
   const { _id, name, color, version, createdAt } = req.body;

   if(!name || name.trim() === "") {
    return res.status(400).json({message: "Folder name is required"});
   }

    const folder = await FolderService.createFolder({
      _id,
      userId: req.user._id,
      name,
      color,
      version,
      createdAt
    });

    // Invalidate cache
    await Promise.all([
      redis.del(`folders:${req.user._id}`),
      redis.del(`notes:${req.user._id}`),
    ]);

    res.status(201).json({
      success: true,
      message: "Folder Created",
      folder 
    });
  
});

export const getAllFolders = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const cacheKey = `folders:${userId}`;

  const cachedFolders = await redis.get(cacheKey);
  if(cachedFolders) {
    return res.json(cachedFolders);
  }
  
    const folders = await FolderService.getUserFolders(userId);
    await redis.set(cacheKey, folders, { ex: 3600 });

    res.json(folders);
});

export const getFolderById = catchAsync(async (req, res) => {
    const folder = await FolderService.getFolderById(
      req.params.id,
      req.user._id,
    );
    res.status(200).json({
      success: true,
      folder,
    });
});

export const getNotesByFolder = catchAsync(async (req, res) => {
    const notes = await FolderService.getNotesByFolder(
      req.params.id,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
});

export const updateFolder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { version, ...updateData } = req.body;

    const result = await FolderService.updateFolderWithVersion(
      id,
      req.user._id,
      version,
      updateData
    );
    if (!result) return res.status(404).json({ message: "Folder not found" });
    
    //version conflict
    if(result.conflict) {
      return res.status(409).json({
        message: "Conflict detected: Folder was updated on another device",
        serverFolder: result.serverFolder,
      });
    }

    // Invalidate cache
    await Promise.all([
      redis.del(`folders:${req.user._id}`),
      redis.del(`notes:${req.user._id}`),
    ]);

    //Successful update
    res.status(200).json({
      message: "Folder updated",
      folder: result.updatedFolder,
});
});

export const deleteFolder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { version } = req.body;// Sent from frontend to prevent accidental deletes

    const result = await FolderService.removeFolderAndNotes(id, req.user._id, version);
    if(!result) {
      return res.status(404).json({ message: "Folder not found" });
    }

    if(result.conflict) {
      return res.status(409).json({
        message: "Conflict detected: Folder was updated on another device",
        serverFolder: result.serverFolder,
      })
    }

    // Invalidate cache
    await redis.del(`folders:${req.user._id}`);

    res.status(200).json({ message: "Folder and all associated notes deleted" });
});
