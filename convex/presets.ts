import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all presets for a user (or all if no user auth)
export const getPresets = query({
  args: {},
  handler: async (ctx) => {
    // For now, return all presets since we don't have user auth yet
    return await ctx.db.query("presets").order("desc").collect();
  },
});

// Get favorite presets
export const getFavoritePresets = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("presets")
      .filter((q) => q.eq(q.field("isFavorite"), true))
      .order("desc")
      .collect();
  },
});

// Create a new preset
export const createPreset = mutation({
  args: {
    name: v.string(),
    parameters: v.object({
      strength: v.number(),
      cfgScale: v.number(),
      steps: v.number(),
      clipSkip: v.number(),
      sampler: v.string(),
      batchCount: v.number(),
      upscaleFactor: v.optional(v.union(v.literal(2), v.literal(4))),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("presets", {
      name: args.name,
      parameters: args.parameters,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a preset
export const updatePreset = mutation({
  args: {
    id: v.id("presets"),
    name: v.optional(v.string()),
    parameters: v.optional(v.object({
      strength: v.number(),
      cfgScale: v.number(),
      steps: v.number(),
      clipSkip: v.number(),
      sampler: v.string(),
      batchCount: v.number(),
      upscaleFactor: v.optional(v.union(v.literal(2), v.literal(4))),
    })),
    isFavorite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a preset
export const deletePreset = mutation({
  args: { id: v.id("presets") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

// Toggle favorite status
export const toggleFavorite = mutation({
  args: { id: v.id("presets") },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.id);
    if (!preset) {
      throw new Error("Preset not found");
    }
    
    return await ctx.db.patch(args.id, {
      isFavorite: !preset.isFavorite,
      updatedAt: Date.now(),
    });
  },
});