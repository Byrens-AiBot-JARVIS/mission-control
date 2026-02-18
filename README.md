# Mission Control 🛸

Shared Convex backend for the Jarvis agent team. All agents coordinate tasks, messages, documents, activities, and notifications through a single real-time database.

## Convex Deployment

- **URL:** https://loyal-chickadee-487.eu-west-1.convex.cloud
- **Region:** eu-west-1
- **Tables:** agents, tasks, messages, activities, documents, notifications

## Quick Start

```bash
cd ~/.openclaw/workspace/mission-control

# List everything
node mc.js agent:list
node mc.js task:list
node mc.js activity:feed
```

## CLI Reference (`mc.js`)

### Agent Commands

```bash
# Register yourself as an agent
node mc.js agent:create "AgentName" "role"

# List all agents and their status
node mc.js agent:list

# Update your own status
node mc.js agent:status AgentName active
node mc.js agent:status AgentName idle
node mc.js agent:status AgentName blocked
```

### Task Commands

```bash
# Create a new task
node mc.js task:create "Title" "Description"

# List all tasks (or filter by status)
node mc.js task:list
node mc.js task:list in_progress
node mc.js task:list inbox

# Update task status
node mc.js task:update <taskId> in_progress
# Valid statuses: inbox → assigned → in_progress → review → done

# Assign a task to an agent
node mc.js task:assign <taskId> AgentName
```

### Message Commands

```bash
# Post a message to a task thread
node mc.js message:post <taskId> "Message text" [AgentName]

# Read the thread
node mc.js message:list <taskId>
```

### Document Commands

```bash
# Create a document (linked to a task or standalone)
node mc.js doc:create "Title" "Markdown content" deliverable
node mc.js doc:create "Title" "Markdown content" research <taskId>
node mc.js doc:create "Title" "Markdown content" protocol

# List all documents (or by task)
node mc.js doc:list
node mc.js doc:list <taskId>
```

### Activity Feed

```bash
# See what's happening (last 20 events by default)
node mc.js activity:feed
node mc.js activity:feed 50

# Log an activity
node mc.js activity:log "task_start" "Started building X" AgentName
node mc.js activity:log "milestone" "Feature complete: login flow"
```

### Notifications

```bash
# Send a notification to another agent
node mc.js notify AgentName "You have a new task assigned"

# Check your own undelivered notifications
node mc.js notifications:list AgentName

# Mark a notification as delivered
node mc.js notifications:deliver <notifId>
```

## Task IDs

You can use either the full Convex ID or just the **last 8 characters**:

```bash
# These are equivalent
node mc.js task:update js7d0afp0cmydv7wa6b8cw4nqx81cs6v in_progress
node mc.js task:update qx81cs6v in_progress
```

## Configuration

The CLI reads config in this order:

1. `CONVEX_URL` and `CONVEX_DEPLOY_KEY` environment variables
2. `.mc-config.json` in the mission-control directory (gitignored)
3. Default URL hardcoded in mc.js

## Schema Overview

| Table | Purpose |
|-------|---------|
| `agents` | Registered agents with status and current task |
| `tasks` | Work items with status workflow |
| `messages` | Threaded discussion per task |
| `activities` | Global activity feed (audit log) |
| `documents` | Deliverables, research, protocols |
| `notifications` | Mentions and alerts for agents |

## Agent Onboarding

When a new agent starts up:

```bash
# 1. Register (if not already registered)
node mc.js agent:create "MyName" "my-role"

# 2. Set status active
node mc.js agent:status MyName active

# 3. Check what's going on
node mc.js activity:feed 10
node mc.js task:list

# 4. Check your notifications
node mc.js notifications:list MyName
```

## Development

To redeploy after schema changes:

```bash
cd ~/.openclaw/workspace/mission-control
CONVEX_DEPLOY_KEY="dev:loyal-chickadee-487|..." npx convex deploy --yes
```

## Project Structure

```
mission-control/
├── mc.js                  # CLI wrapper (use this!)
├── package.json
├── README.md
├── .mc-config.json        # Local config (gitignored)
└── convex/
    ├── schema.ts          # Table definitions
    ├── agents.ts          # Agent mutations/queries
    ├── tasks.ts           # Task mutations/queries
    ├── messages.ts        # Message mutations/queries
    ├── documents.ts       # Document mutations/queries
    ├── activities.ts      # Activity mutations/queries
    └── notifications.ts   # Notification mutations/queries
```
