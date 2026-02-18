#!/usr/bin/env node
/**
 * Mission Control CLI
 * Usage: node mc.js <command> [args...]
 *
 * Commands:
 *   task:create "Title" "Description"
 *   task:list [status]
 *   task:update <id> <status>
 *   task:assign <id> <agentName>
 *   message:post <taskId> "Message text" [agentName]
 *   message:list <taskId>
 *   doc:create "Title" "Content" <type>
 *   doc:list [taskId]
 *   agent:create "Name" "Role"
 *   agent:list
 *   agent:status <name> <status>
 *   activity:feed [limit]
 *   activity:log <type> "Message" [agentName]
 *   notify <agentName> "Message"
 *   notifications:list [agentName]
 *   notifications:deliver <id>
 */

const path = require("path");
const fs = require("fs");

// ── Config ─────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, ".mc-config.json");

function loadConfig() {
  const config = {};
  // 1. Env vars
  if (process.env.CONVEX_URL) config.url = process.env.CONVEX_URL;
  if (process.env.CONVEX_DEPLOY_KEY) config.deployKey = process.env.CONVEX_DEPLOY_KEY;
  // 2. Config file
  if (fs.existsSync(CONFIG_FILE)) {
    const file = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (!config.url && file.url) config.url = file.url;
    if (!config.deployKey && file.deployKey) config.deployKey = file.deployKey;
  }
  if (!config.url) config.url = "https://loyal-chickadee-487.eu-west-1.convex.cloud";
  return config;
}

// ── HTTP client for Convex HTTP API ────────────────────────────────────────
async function convexCall(config, type, name, args = {}) {
  const url = `${config.url}/api/${type}`;
  const body = JSON.stringify({ path: name, args, format: "json" });

  const headers = { "Content-Type": "application/json" };
  if (config.deployKey) headers["Authorization"] = `Convex ${config.deployKey}`;

  const resp = await fetch(url, { method: "POST", headers, body });
  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(`Convex ${type} failed (${resp.status}): ${text}`);
  }

  const json = JSON.parse(text);
  if (json.status === "error") {
    throw new Error(`Convex error: ${json.errorMessage}`);
  }
  return json.value !== undefined ? json.value : json;
}

function query(config, name, args = {}) {
  return convexCall(config, "query", name, args);
}

function mutation(config, name, args = {}) {
  return convexCall(config, "mutation", name, args);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(obj) {
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "(none)";
    return obj.map(formatItem).join("\n");
  }
  return JSON.stringify(obj, null, 2);
}

function formatItem(item) {
  if (!item || typeof item !== "object") return String(item);
  const id = item._id ? `[${item._id.slice(-8)}]` : "";
  if (item.title) return `${id} ${item.title} — ${item.status ?? item.type ?? ""}`;
  if (item.message) return `${id} [${item.type ?? "activity"}] ${item.message}`;
  if (item.content) return `${id} ${item.content}`;
  return JSON.stringify(item);
}

function ts(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const config = loadConfig();
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd) {
    console.log(`
Mission Control CLI
───────────────────
task:create "Title" "Description"
task:list [status]
task:update <id> <status>
task:assign <id> <agentName>
message:post <taskId> "Message" [agentName]
message:list <taskId>
doc:create "Title" "Content" <deliverable|research|protocol>
doc:list [taskId]
agent:create "Name" "Role"
agent:list
agent:status <name> <idle|active|blocked>
activity:feed [limit]
activity:log <type> "Message" [agentName]
notify <agentName> "Message"
notifications:list [agentName]
notifications:deliver <notifId>
`);
    return;
  }

  // ── task:create ──────────────────────────────────────────────────────────
  if (cmd === "task:create") {
    const [title, description] = rest;
    if (!title) throw new Error("Usage: task:create \"Title\" \"Description\"");
    const id = await mutation(config, "tasks:create", {
      title,
      description: description ?? "",
    });
    console.log(`✅ Task created: ${id}`);
    return;
  }

  // ── task:list ────────────────────────────────────────────────────────────
  if (cmd === "task:list") {
    const [status] = rest;
    const tasks = await query(config, "tasks:list", status ? { status } : {});
    if (!tasks.length) { console.log("No tasks found."); return; }
    for (const t of tasks) {
      const assignees = t.assigneeIds?.length ? ` (${t.assigneeIds.length} assignee(s))` : "";
      console.log(`[${t._id.slice(-8)}] [${t.status}] ${t.title}${assignees}`);
    }
    return;
  }

  // ── task:update ──────────────────────────────────────────────────────────
  if (cmd === "task:update") {
    const [idSuffix, status] = rest;
    if (!idSuffix || !status) throw new Error("Usage: task:update <id> <status>");
    // Accept full id or last 8 chars
    const tasks = await query(config, "tasks:list", {});
    const task = tasks.find((t) => t._id === idSuffix || t._id.endsWith(idSuffix));
    if (!task) throw new Error(`Task not found: ${idSuffix}`);
    await mutation(config, "tasks:update", { taskId: task._id, status });
    console.log(`✅ Task updated → ${status}`);
    return;
  }

  // ── task:assign ──────────────────────────────────────────────────────────
  if (cmd === "task:assign") {
    const [idSuffix, agentName] = rest;
    if (!idSuffix || !agentName) throw new Error("Usage: task:assign <id> <agentName>");
    const [tasks, agents] = await Promise.all([
      query(config, "tasks:list", {}),
      query(config, "agents:list", {}),
    ]);
    const task = tasks.find((t) => t._id === idSuffix || t._id.endsWith(idSuffix));
    if (!task) throw new Error(`Task not found: ${idSuffix}`);
    const agent = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase());
    if (!agent) throw new Error(`Agent not found: ${agentName}`);
    await mutation(config, "tasks:assign", { taskId: task._id, agentIds: [agent._id] });
    console.log(`✅ Task assigned to ${agent.name}`);
    return;
  }

  // ── message:post ─────────────────────────────────────────────────────────
  if (cmd === "message:post") {
    const [taskIdSuffix, content, agentName] = rest;
    if (!taskIdSuffix || !content) throw new Error("Usage: message:post <taskId> \"Message\" [agentName]");
    const [tasks, agents] = await Promise.all([
      query(config, "tasks:list", {}),
      query(config, "agents:list", {}),
    ]);
    const task = tasks.find((t) => t._id === taskIdSuffix || t._id.endsWith(taskIdSuffix));
    if (!task) throw new Error(`Task not found: ${taskIdSuffix}`);

    let agentId;
    if (agentName) {
      const agent = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase());
      if (!agent) throw new Error(`Agent not found: ${agentName}`);
      agentId = agent._id;
    } else {
      // Use first agent as sender, or create a system agent
      if (!agents.length) throw new Error("No agents found — create one first with agent:create");
      agentId = agents[0]._id;
    }
    const id = await mutation(config, "messages:create", {
      taskId: task._id,
      fromAgentId: agentId,
      content,
    });
    console.log(`✅ Message posted: ${id}`);
    return;
  }

  // ── message:list ─────────────────────────────────────────────────────────
  if (cmd === "message:list") {
    const [taskIdSuffix] = rest;
    if (!taskIdSuffix) throw new Error("Usage: message:list <taskId>");
    const tasks = await query(config, "tasks:list", {});
    const task = tasks.find((t) => t._id === taskIdSuffix || t._id.endsWith(taskIdSuffix));
    if (!task) throw new Error(`Task not found: ${taskIdSuffix}`);
    const msgs = await query(config, "messages:listByTask", { taskId: task._id });
    if (!msgs.length) { console.log("No messages for this task."); return; }
    const agents = await query(config, "agents:list", {});
    const agentMap = Object.fromEntries(agents.map((a) => [a._id, a.name]));
    for (const m of msgs) {
      const from = agentMap[m.fromAgentId] ?? m.fromAgentId.slice(-8);
      console.log(`[${ts(m._creationTime)}] ${from}: ${m.content}`);
    }
    return;
  }

  // ── doc:create ───────────────────────────────────────────────────────────
  if (cmd === "doc:create") {
    const [title, content, type, taskIdSuffix] = rest;
    if (!title || !content || !type) {
      throw new Error("Usage: doc:create \"Title\" \"Content\" <deliverable|research|protocol> [taskId]");
    }
    const args = { title, content, type };
    if (taskIdSuffix) {
      const tasks = await query(config, "tasks:list", {});
      const task = tasks.find((t) => t._id === taskIdSuffix || t._id.endsWith(taskIdSuffix));
      if (task) args.taskId = task._id;
    }
    const id = await mutation(config, "documents:create", args);
    console.log(`✅ Document created: ${id}`);
    return;
  }

  // ── doc:list ─────────────────────────────────────────────────────────────
  if (cmd === "doc:list") {
    const [taskIdSuffix] = rest;
    let docs;
    if (taskIdSuffix) {
      const tasks = await query(config, "tasks:list", {});
      const task = tasks.find((t) => t._id === taskIdSuffix || t._id.endsWith(taskIdSuffix));
      if (!task) throw new Error(`Task not found: ${taskIdSuffix}`);
      docs = await query(config, "documents:listByTask", { taskId: task._id });
    } else {
      docs = await query(config, "documents:listAll", {});
    }
    if (!docs.length) { console.log("No documents found."); return; }
    for (const d of docs) {
      console.log(`[${d._id.slice(-8)}] [${d.type}] ${d.title}`);
    }
    return;
  }

  // ── agent:create ─────────────────────────────────────────────────────────
  if (cmd === "agent:create") {
    const [name, role] = rest;
    if (!name || !role) throw new Error("Usage: agent:create \"Name\" \"Role\"");
    const id = await mutation(config, "agents:create", { name, role });
    console.log(`✅ Agent created: ${id}`);
    return;
  }

  // ── agent:list ───────────────────────────────────────────────────────────
  if (cmd === "agent:list") {
    const agents = await query(config, "agents:list", {});
    if (!agents.length) { console.log("No agents found."); return; }
    for (const a of agents) {
      const task = a.currentTaskId ? ` → task:${a.currentTaskId.slice(-8)}` : "";
      console.log(`[${a._id.slice(-8)}] [${a.status}] ${a.name} — ${a.role}${task}`);
    }
    return;
  }

  // ── agent:status ─────────────────────────────────────────────────────────
  if (cmd === "agent:status") {
    const [agentName, status] = rest;
    if (!agentName || !status) throw new Error("Usage: agent:status <name> <idle|active|blocked>");
    const agent = await query(config, "agents:getByName", { name: agentName });
    if (!agent) throw new Error(`Agent not found: ${agentName}`);
    await mutation(config, "agents:updateStatus", { agentId: agent._id, status });
    console.log(`✅ ${agentName} status → ${status}`);
    return;
  }

  // ── activity:feed ────────────────────────────────────────────────────────
  if (cmd === "activity:feed") {
    const [limitStr] = rest;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const activities = await query(config, "activities:listRecent", { limit });
    if (!activities.length) { console.log("No activities."); return; }
    for (const a of activities) {
      console.log(`[${ts(a.timestamp)}] [${a.type}] ${a.message}`);
    }
    return;
  }

  // ── activity:log ─────────────────────────────────────────────────────────
  if (cmd === "activity:log") {
    const [type, message, agentName] = rest;
    if (!type || !message) throw new Error("Usage: activity:log <type> \"Message\" [agentName]");
    const args = { type, message };
    if (agentName) {
      const agent = await query(config, "agents:getByName", { name: agentName });
      if (agent) args.agentId = agent._id;
    }
    const id = await mutation(config, "activities:create", args);
    console.log(`✅ Activity logged: ${id}`);
    return;
  }

  // ── notify ───────────────────────────────────────────────────────────────
  if (cmd === "notify") {
    const [agentName, content] = rest;
    if (!agentName || !content) throw new Error("Usage: notify <agentName> \"Message\"");
    const agent = await query(config, "agents:getByName", { name: agentName });
    if (!agent) throw new Error(`Agent not found: ${agentName}`);
    const id = await mutation(config, "notifications:create", {
      mentionedAgentId: agent._id,
      content,
    });
    console.log(`✅ Notification sent to ${agentName}: ${id}`);
    return;
  }

  // ── notifications:list ───────────────────────────────────────────────────
  if (cmd === "notifications:list") {
    const [agentName] = rest;
    let args = {};
    if (agentName) {
      const agent = await query(config, "agents:getByName", { name: agentName });
      if (!agent) throw new Error(`Agent not found: ${agentName}`);
      args.agentId = agent._id;
    }
    const notifs = await query(config, "notifications:listUndelivered", args);
    if (!notifs.length) { console.log("No undelivered notifications."); return; }
    const agents = await query(config, "agents:list", {});
    const agentMap = Object.fromEntries(agents.map((a) => [a._id, a.name]));
    for (const n of notifs) {
      const to = agentMap[n.mentionedAgentId] ?? n.mentionedAgentId.slice(-8);
      console.log(`[${n._id.slice(-8)}] → ${to}: ${n.content}`);
    }
    return;
  }

  // ── notifications:deliver ────────────────────────────────────────────────
  if (cmd === "notifications:deliver") {
    const [notifIdSuffix] = rest;
    if (!notifIdSuffix) throw new Error("Usage: notifications:deliver <notifId>");
    const notifs = await query(config, "notifications:listUndelivered", {});
    const notif = notifs.find(
      (n) => n._id === notifIdSuffix || n._id.endsWith(notifIdSuffix)
    );
    if (!notif) throw new Error(`Notification not found: ${notifIdSuffix}`);
    await mutation(config, "notifications:markDelivered", { notificationId: notif._id });
    console.log(`✅ Notification marked delivered`);
    return;
  }

  throw new Error(`Unknown command: ${cmd}\nRun 'node mc.js' for usage.`);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
