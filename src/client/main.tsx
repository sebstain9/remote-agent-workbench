import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequestDraft,
  Play,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  XCircle
} from "lucide-react";
import {
  type CreateTaskInput,
  type HealthResponse,
  type Task,
  type TaskDetail,
  type TaskStatus,
  type WorkspaceCandidate
} from "../shared/types.js";
import "./styles.css";

const statusLabels: Record<TaskStatus, string> = {
  queued: "Queued",
  preparing: "Preparing",
  codex_running: "Codex running",
  review_running: "Claude review",
  testing: "Verifying",
  committing: "Committing",
  done: "Done",
  codex_failed: "Codex failed",
  review_failed: "Review failed",
  test_failed: "Verification failed",
  commit_failed: "Commit failed",
  needs_test_command: "Needs test command"
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [diff, setDiff] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceCandidate[]>([]);
  const [form, setForm] = useState<CreateTaskInput>({
    workspacePath: "",
    title: "",
    prompt: "",
    testCommand: ""
  });
  const [manualWorkspace, setManualWorkspace] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshAll({ includeWorkspaces: true });
    const timer = window.setInterval(() => void refreshAll(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId && tasks[0]) setSelectedId(tasks[0].id);
  }, [selectedId, tasks]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDiff("");
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (form.workspacePath || workspaces.length === 0) return;
    const bestWorkspace = workspaces.find((workspace) => workspace.clean) ?? workspaces[0];
    setForm((current) => (current.workspacePath ? current : { ...current, workspacePath: bestWorkspace.path }));
  }, [form.workspacePath, workspaces]);

  const selected = detail ?? tasks.find((task) => task.id === selectedId) ?? null;
  const selectedWorkspace = workspaces.find((workspace) => workspace.path === form.workspacePath);
  const selectedWorkspaceDirty = selectedWorkspace?.clean === false;
  const canSubmit =
    !isSubmitting &&
    !selectedWorkspaceDirty &&
    Boolean(form.workspacePath.trim()) &&
    Boolean(form.title.trim()) &&
    Boolean(form.prompt.trim());

  async function refreshAll(options: { includeWorkspaces?: boolean } = {}) {
    const [nextHealth, nextTasks] = await Promise.all([fetchJson<HealthResponse>("/api/health"), fetchJson<Task[]>("/api/tasks")]);
    setHealth(nextHealth);
    setTasks(nextTasks);
    if (options.includeWorkspaces) await loadWorkspaces();
    if (selectedId) await loadDetail(selectedId);
  }

  async function loadWorkspaces() {
    setIsLoadingWorkspaces(true);
    try {
      setWorkspaces(await fetchJson<WorkspaceCandidate[]>("/api/workspaces"));
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }

  async function loadDetail(id: string) {
    const [nextDetail, nextDiff] = await Promise.all([
      fetchJson<TaskDetail>(`/api/tasks/${id}`),
      fetchJson<{ diff: string }>(`/api/tasks/${id}/diff`)
    ]);
    setDetail(nextDetail);
    setDiff(nextDiff.diff);
  }

  async function submitTask(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const task = await postJson<Task>("/api/tasks", {
        ...form,
        testCommand: form.testCommand?.trim() || undefined
      });
      setSelectedId(task.id);
      setForm((current) => ({ ...current, title: "", prompt: "" }));
      await refreshAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Agent Workbench</h1>
          <p>Run AI coding tasks through clean worktrees, review gates, verification, and local commits.</p>
        </div>
        <div className="top-actions">
          <ToolStatus health={health} />
          <button className="refresh-button" type="button" onClick={() => void refreshAll({ includeWorkspaces: true })} aria-label="Refresh">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="command-panel">
          <div className="panel-head">
            <div>
              <span>New run</span>
              <h2>Define task</h2>
            </div>
            <StatusPill health={health} />
          </div>

          <form className="task-form" onSubmit={submitTask}>
            <div className="section-heading">
              <GitBranch size={17} />
              <h3>Repository</h3>
            </div>
            <RepositoryPicker
              isLoading={isLoadingWorkspaces}
              manual={manualWorkspace || workspaces.length === 0}
              onChange={(workspacePath) => setForm({ ...form, workspacePath })}
              onRefresh={() => void loadWorkspaces()}
              onToggleManual={() => setManualWorkspace((current) => !current)}
              selectedWorkspace={selectedWorkspace}
              value={form.workspacePath}
              workspaces={workspaces}
            />

            <div className="section-heading form-break">
              <Bot size={17} />
              <h3>Task</h3>
            </div>
            <label>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Fix settings persistence"
              />
            </label>
            <label>
              <span>What should change?</span>
              <textarea
                value={form.prompt}
                onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                placeholder="Example: fix the settings page so toggles survive refresh."
                rows={8}
              />
            </label>
            <label>
              <span>Verification command</span>
              <input
                value={form.testCommand ?? ""}
                onChange={(event) => setForm({ ...form, testCommand: event.target.value })}
                placeholder="Optional, for example npm run typecheck"
              />
            </label>
            {selectedWorkspaceDirty ? <p className="form-error">This repository has uncommitted changes. Clean it before starting.</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button
              className="primary-button"
              type="submit"
              disabled={!canSubmit}
            >
              <Play size={16} />
              <span>{isSubmitting ? "Starting..." : "Start run"}</span>
            </button>
          </form>

          <div className="run-steps" aria-label="Run steps">
            <Step icon={<TerminalSquare size={16} />} title="Codex implements" />
            <Step icon={<ShieldCheck size={16} />} title="Claude reviews" />
            <Step icon={<GitCommitHorizontal size={16} />} title="Local commit" />
          </div>
        </section>

        <section className="detail" aria-label="Task detail">
          {selected ? (
            <TaskDetailView task={selected} detail={detail} diff={diff} />
          ) : (
            <EmptyDetail />
          )}
        </section>

        <aside className="history-panel" aria-label="Run history">
          <div className="section-heading">
            <Clock3 size={17} />
              <h3>History</h3>
          </div>
          <div className="task-items">
            {tasks.map((task) => (
              <button
                className={task.id === selectedId ? "task-row selected" : "task-row"}
                type="button"
                key={task.id}
                onClick={() => setSelectedId(task.id)}
              >
                <span className={`status-dot ${statusTone(task.status)}`} />
                <strong>{task.title}</strong>
                <small>{statusLabels[task.status]}</small>
              </button>
            ))}
            {tasks.length === 0 ? <p className="empty">No runs yet.</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function RepositoryPicker({
  isLoading,
  manual,
  onChange,
  onRefresh,
  onToggleManual,
  selectedWorkspace,
  value,
  workspaces
}: {
  isLoading: boolean;
  manual: boolean;
  onChange: (workspacePath: string) => void;
  onRefresh: () => void;
  onToggleManual: () => void;
  selectedWorkspace?: WorkspaceCandidate;
  value: string;
  workspaces: WorkspaceCandidate[];
}) {
  return (
    <div className="repo-picker">
      {workspaces.length > 0 ? (
        <>
          <label>
            <span>Select repository</span>
            <select value={value} onChange={(event) => onChange(event.target.value)}>
              {workspaces.map((workspace) => (
                <option value={workspace.path} key={workspace.repoRoot}>
                  {workspace.name}
                  {workspace.clean ? "" : " (dirty)"}
                </option>
              ))}
            </select>
          </label>
          {selectedWorkspace ? <WorkspaceSummary workspace={selectedWorkspace} /> : null}
        </>
      ) : (
        <p className="helper-text">No git repository found. Rescan or enter a path manually.</p>
      )}

      <div className="repo-actions">
        <button className="text-button" type="button" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={13} />
          <span>{isLoading ? "Scanning" : "Rescan"}</span>
        </button>
        <button className="text-button" type="button" onClick={onToggleManual}>
          {manual && workspaces.length > 0 ? "Hide path" : "Manual path"}
        </button>
      </div>

      {manual ? (
        <label>
          <span>Path fallback</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="~/projects/my-repo"
            spellCheck={false}
          />
        </label>
      ) : null}
    </div>
  );
}

function WorkspaceSummary({ workspace }: { workspace: WorkspaceCandidate }) {
  return (
    <div className={workspace.clean ? "repo-summary" : "repo-summary warn"}>
      <span>{workspace.source === "recent" ? "recent" : "detected"} · {workspace.clean ? "clean" : "dirty"}</span>
      <code>{workspace.path}</code>
    </div>
  );
}

function TaskDetailView({ task, detail, diff }: { task: Task; detail: TaskDetail | null; diff: string }) {
  const duration = useMemo(() => {
    if (!task.startedAt) return "not started";
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    return `${Math.max(1, Math.round((end - new Date(task.startedAt).getTime()) / 1000))}s`;
  }, [task.startedAt, task.completedAt]);

  return (
    <>
      <div className="detail-head">
        <div>
          <h2>{task.title}</h2>
          <p>{statusLabels[task.status]} · {duration}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {task.error ? <div className="error-banner">{task.error}</div> : null}

      <div className="result-grid">
        <ResultBlock title="Commit" icon={<GitCommitHorizontal size={16} />}>
          <KeyValue label="Branch" value={task.branchName ?? "-"} />
          <KeyValue label="Worktree" value={task.worktreePath ?? "-"} />
          <KeyValue label="Commit" value={task.commitHash ?? "-"} />
        </ResultBlock>

        <ResultBlock title="Codex" icon={<TerminalSquare size={16} />}>
          <pre>{task.codex?.summary || "Waiting for implementation."}</pre>
        </ResultBlock>

        <ResultBlock title="Claude review" icon={<CheckCircle2 size={16} />}>
          <p className={task.review?.verdict === "pass" ? "verdict pass" : "verdict"}>
            {task.review ? verdictLabel(task.review.verdict) : "Pending review"}
          </p>
          <pre>{task.review?.summary || "Waiting for review."}</pre>
          {task.review?.risks.length ? <ul>{task.review.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : null}
        </ResultBlock>

        <ResultBlock title="Verification" icon={<Activity size={16} />}>
          <KeyValue label="Command" value={task.test?.command ?? task.testCommand ?? "auto-select"} />
          <KeyValue label="Exit code" value={task.test ? String(task.test.exitCode) : "-"} />
          <pre>{task.test?.stderr || task.test?.stdout || "Waiting for verification."}</pre>
        </ResultBlock>
      </div>

      <div className="wide-block">
        <div className="section-heading">
          <GitBranch size={17} />
          <h2>Diff</h2>
        </div>
        <pre>{diff || task.diffStat || "No diff yet."}</pre>
      </div>

      <div className="wide-block">
        <div className="section-heading">
          <GitPullRequestDraft size={17} />
          <h2>Logs</h2>
        </div>
        <pre>{detail?.logs.join("\n") || "No logs yet."}</pre>
      </div>
    </>
  );
}

function ToolStatus({ health }: { health: HealthResponse | null }) {
  const checks = health?.checks ?? [];
  return (
    <div className="tool-status" aria-label="Tool status">
      {checks.map((check) => (
        <span className={check.ok ? "tool-chip ok" : "tool-chip bad"} key={check.name}>
          {check.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {check.name}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ health }: { health: HealthResponse | null }) {
  if (!health) {
    return (
      <span className="status-pill neutral">
        <Activity size={14} />
        Checking
      </span>
    );
  }

  const ok = health.ok;
  return (
    <span className={ok ? "status-pill ok" : "status-pill warn"}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {ok ? "Ready" : "Tool issue"}
    </span>
  );
}

function Step({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="run-step">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="empty-detail">
      <div className="empty-mark">
        <GitCommitHorizontal size={28} />
      </div>
      <h2>No run selected</h2>
      <p>Create a task on the left and the reviewed result will appear here.</p>
    </div>
  );
}

function ResultBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="result-block">
      <div className="section-heading">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </article>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <p className="key-value">
      <span>{label}</span>
      <code>{value}</code>
    </p>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge ${statusTone(status)}`}>{statusLabels[status]}</span>;
}

function verdictLabel(verdict: "pass" | "fail"): string {
  return verdict === "pass" ? "Pass" : "Fail";
}

function statusTone(status: TaskStatus): string {
  if (status === "done") return "green";
  if (status.endsWith("failed") || status === "needs_test_command") return "red";
  if (status === "queued" || status === "preparing") return "amber";
  return "blue";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(error.error ?? response.statusText);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(error.error ?? response.statusText);
  }
  return (await response.json()) as T;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
