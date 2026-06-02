import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Task, type TaskDetail } from "../shared/types.js";

export class TaskStore {
  private readonly tasksPath: string;
  private readonly logsDir: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly workRoot: string) {
    this.tasksPath = join(workRoot, "tasks.json");
    this.logsDir = join(workRoot, "logs");
  }

  async ensure(): Promise<void> {
    await mkdir(this.workRoot, { recursive: true });
    await mkdir(this.logsDir, { recursive: true });
    try {
      await readFile(this.tasksPath, "utf8");
    } catch {
      await writeFile(this.tasksPath, "[]\n", "utf8");
    }
  }

  async listTasks(): Promise<Task[]> {
    await this.ensure();
    const raw = await readFile(this.tasksPath, "utf8");
    const tasks = JSON.parse(raw) as Task[];
    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const tasks = await this.listTasks();
    return tasks.find((task) => task.id === id);
  }

  async getTaskDetail(id: string): Promise<TaskDetail | undefined> {
    const task = await this.getTask(id);
    if (!task) return undefined;
    return { ...task, logs: await this.readLogs(id) };
  }

  async insertTask(task: Task): Promise<void> {
    await this.withWriteLock(async () => {
      const tasks = await this.listTasks();
      await this.writeTasks([task, ...tasks]);
    });
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    return await this.withWriteLock(async () => {
      const tasks = await this.listTasks();
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) throw new Error(`Task not found: ${id}`);
      const updated: Task = { ...tasks[index], ...patch, updatedAt: new Date().toISOString() };
      tasks[index] = updated;
      await this.writeTasks(tasks);
      return updated;
    });
  }

  async appendLog(taskId: string, phase: string, message: string): Promise<void> {
    await this.ensure();
    const line = JSON.stringify({
      at: new Date().toISOString(),
      phase,
      message
    });
    await writeFile(this.logPath(taskId), `${line}\n`, { flag: "a", encoding: "utf8" });
  }

  async readLogs(taskId: string): Promise<string[]> {
    try {
      const raw = await readFile(this.logPath(taskId), "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const parsed = JSON.parse(line) as { at: string; phase: string; message: string };
            return `[${parsed.at}] ${parsed.phase}: ${parsed.message}`;
          } catch {
            return line;
          }
        });
    } catch {
      return [];
    }
  }

  private async writeTasks(tasks: Task[]): Promise<void> {
    await this.ensure();
    await writeFile(this.tasksPath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  }

  private logPath(taskId: string): string {
    return join(this.logsDir, `${taskId}.jsonl`);
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeLock.then(operation, operation);
    this.writeLock = run.then(
      () => undefined,
      () => undefined
    );
    return await run;
  }
}
