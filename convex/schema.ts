import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,
  
  // AI Models storage
  models: defineTable({
    name: v.string(),
    type: v.union(v.literal("lora"), v.literal("full")),
    fileId: v.optional(v.id("_storage")), // Reference to uploaded file - optional for now
    fileSize: v.number(),
    uploadedAt: v.number(),
    userId: v.optional(v.id("users")), // Optional for now
    metadata: v.optional(v.object({
      description: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      category: v.optional(v.string()),
    })),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"])
    .index("by_user_and_type", ["userId", "type"]),

  // Processing jobs for style transfer
  processingJobs: defineTable({
    userId: v.optional(v.id("users")), // Optional for now
    inputImageId: v.optional(v.id("_storage")), // Optional for now
    modelId: v.optional(v.id("models")), // Optional for now
    parameters: v.object({
      strength: v.number(),
      cfgScale: v.number(),
      steps: v.number(),
      clipSkip: v.number(),
      seed: v.optional(v.number()),
      sampler: v.string(),
      batchCount: v.number(),
      upscaleFactor: v.optional(v.union(v.literal(2), v.literal(4))),
    }),
    status: v.union(
      v.literal("pending"),
      v.literal("initializing"),
      v.literal("loading_model"),
      v.literal("generating"),
      v.literal("upscaling"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100
    currentStep: v.optional(v.string()),
    estimatedTimeRemaining: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    resultImageIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"]),

  // User presets for parameters
  presets: defineTable({
    userId: v.optional(v.id("users")), // Optional for now
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
    isFavorite: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_favorite", ["userId", "isFavorite"]),

  // Generated results
  results: defineTable({
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
    isFavorite: v.boolean(),
    userId: v.optional(v.id("users")), // Optional for now
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_created", ["createdAt"]),

  // System information and hardware stats
  systemInfo: defineTable({
    userId: v.optional(v.id("users")), // Optional for now
    hardwareInfo: v.object({
      cpu: v.optional(v.string()),
      ram: v.optional(v.string()),
      gpu: v.optional(v.string()),
      cudaAvailable: v.optional(v.boolean()),
      pytorchVersion: v.optional(v.string()),
    }),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"]),
})