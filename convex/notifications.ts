import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    mentionedAgentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const notifId = await ctx.db.insert("notifications", {
      mentionedAgentId: args.mentionedAgentId,
      content: args.content,
      delivered: false,
      createdAt: Date.now(),
    });
    return notifId;
  },
});

export const listUndelivered = query({
  args: { agentId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    if (args.agentId) {
      return await ctx.db
        .query("notifications")
        .withIndex("by_agent", (q) => q.eq("mentionedAgentId", args.agentId!))
        .filter((q) => q.eq(q.field("delivered"), false))
        .collect();
    }
    return await ctx.db
      .query("notifications")
      .withIndex("by_delivered", (q) => q.eq("delivered", false))
      .collect();
  },
});

export const markDelivered = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { delivered: true });
  },
});
