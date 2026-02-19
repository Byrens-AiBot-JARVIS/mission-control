import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("calendar").collect();
    return entries.sort((a, b) => a.schedule.localeCompare(b.schedule));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    schedule: v.string(),
    cronExpr: v.string(),
    enabled: v.boolean(),
    type: v.union(v.literal("cron"), v.literal("task")),
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("calendar", args);
  },
});

export const toggle = mutation({
  args: { id: v.id("calendar") },
  handler: async (ctx, { id }) => {
    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Calendar entry not found");
    await ctx.db.patch(id, { enabled: !entry.enabled });
  },
});

export const upsertByTitle = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    schedule: v.string(),
    cronExpr: v.string(),
    enabled: v.boolean(),
    type: v.union(v.literal("cron"), v.literal("task")),
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calendar")
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("calendar", args);
    }
  },
});
