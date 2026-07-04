export interface BroadcastJob {
  id: string;
  status: "running" | "done" | "error";
  sent: number;
  failed: number;
  total: number;
  message: string;
  startedAt: number;
}

const jobs = new Map<string, BroadcastJob>();

export function createJob(total: number): BroadcastJob {
  const id = crypto.randomUUID();
  const job: BroadcastJob = {
    id,
    status: "running",
    sent: 0,
    failed: 0,
    total,
    message: "",
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  // Auto-cleanup after 10 minutes
  setTimeout(() => jobs.delete(id), 10 * 60 * 1000);
  return job;
}

export function updateJob(
  id: string,
  patch: Partial<BroadcastJob>
): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function getJob(id: string): BroadcastJob | undefined {
  return jobs.get(id);
}
