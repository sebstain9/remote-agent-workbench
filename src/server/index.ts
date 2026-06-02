import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProductionAgents } from "./agents.js";
import { loadConfig } from "./config.js";
import { createDemoTask } from "./demo.js";
import { getDiffOrEmpty } from "./git.js";
import { getHealth } from "./health.js";
import { TaskOrchestrator } from "./orchestrator.js";
import { TaskStore } from "./store.js";
import { discoverWorkspaces } from "./workspaces.js";
import { createTaskSchema } from "../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const store = new TaskStore(config.workRoot);
const orchestrator = new TaskOrchestrator(config, store, createProductionAgents(config));
const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    res.json(await getHealth(config));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_req, res, next) => {
  try {
    res.json(await store.listTasks());
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspaces", async (_req, res, next) => {
  try {
    res.json(await discoverWorkspaces(config, store));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body);
    const task = await orchestrator.createTask(input);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

app.post("/api/demo/tasks", async (_req, res, next) => {
  try {
    res.status(201).json(await createDemoTask(store));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/:id", async (req, res, next) => {
  try {
    const task = await store.getTaskDetail(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/:id/diff", async (req, res, next) => {
  try {
    const task = await store.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({ diff: task.diff || (await getDiffOrEmpty(config, task.worktreePath)) });
  } catch (error) {
    next(error);
  }
});

await attachFrontend(app);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  const isBadRequest =
    message.includes("not clean") ||
    message.includes("Not a git repository") ||
    error instanceof SyntaxError ||
    (typeof error === "object" && error !== null && "name" in error && error.name === "ZodError");
  res.status(isBadRequest ? 400 : 500).json({
    error: message
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Remote Agent Workbench listening on http://${config.host}:${config.port}`);
  console.log(`Local URL: http://localhost:${config.port}`);
});

async function attachFrontend(server: express.Express): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    const dist = resolve(config.appRoot, "dist/client");
    server.use(express.static(dist));
    server.get("*", (_req, res) => res.sendFile(resolve(dist, "index.html")));
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    root: config.appRoot,
    server: { middlewareMode: true },
    appType: "spa"
  });
  server.use(vite.middlewares);
  server.use("*", async (req, res, next) => {
    try {
      const indexPath = resolve(config.appRoot, "index.html");
      const template = existsSync(indexPath) ? indexPath : resolve(__dirname, "../../index.html");
      const html = await vite.transformIndexHtml(req.originalUrl, await import("node:fs/promises").then((fs) => fs.readFile(template, "utf8")));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}
