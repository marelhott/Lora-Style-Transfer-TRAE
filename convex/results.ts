import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Get all results (most recent first)
export const getResults = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("results")
      .withIndex("by_created")
      .order("desc")
      .collect();
  },
});

// Get favorite results
export const getFavoriteResults = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("results")
      .filter((q) => q.eq(q.field("isFavorite"), true))
      .order("desc")
      .collect();
  },
});

// Create a new result
export const createResult = mutation({
  args: {
    imageUrl: v.string(),
    seed: v.number(),
    parameters: v.object({
      strength: v.number(),
      cfgScale: v.number(),
      steps: v.number(),
      sampler: v.string(),
    }),
    modelName: v.optional(v.string()),
    loraName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("results", {
      ...args,
      isFavorite: false,
      createdAt: Date.now(),
    });
  },
});

// Create multiple results (for batch processing)
export const createResults = mutation({
  args: {
    results: v.array(v.object({
      imageUrl: v.string(),
      seed: v.number(),
      parameters: v.object({
        strength: v.number(),
        cfgScale: v.number(),
        steps: v.number(),
        sampler: v.string(),
      }),
      modelName: v.optional(v.string()),
      loraName: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const resultIds: Id<'results'>[] = [];
    
    for (const result of args.results) {
      const id = await ctx.db.insert("results", {
        ...result,
        isFavorite: false,
        createdAt: now,
      });
      resultIds.push(id);
    }
    
    return resultIds;
  },
});

// Toggle favorite status
export const toggleFavorite = mutation({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.id);
    if (!result) {
      throw new Error("Result not found");
    }
    
    return await ctx.db.patch(args.id, {
      isFavorite: !result.isFavorite,
    });
  },
});

// Delete a result
export const deleteResult = mutation({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});