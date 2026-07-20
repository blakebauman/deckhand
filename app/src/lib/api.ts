let baseUrl = (import.meta as any).env?.VITE_SIDECAR_URL || "http://127.0.0.1:7420";

export function setApiBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return baseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  status: () => request<StatusResponse>("/api/status"),

  dockerDashboard: () => request<Record<string, number>>("/api/docker/dashboard"),
  dockerInfo: () => request<any>("/api/docker/info"),
  gpus: () => request<GPUStatus>("/api/docker/gpus"),
  dockerEventsUrl: () => `${baseUrl}/api/docker/events`,
  imagePullUrl: () => `${baseUrl}/api/docker/images/pull`,
  containers: (all = true) => request<any[]>(`/api/docker/containers?all=${all}`),
  container: (id: string) => request<any>(`/api/docker/containers/${id}`),
  createContainer: (body: RunContainerBody) =>
    request<RunContainerResult>("/api/docker/containers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startContainer: (id: string) => request(`/api/docker/containers/${id}/start`, { method: "POST" }),
  stopContainer: (id: string) => request(`/api/docker/containers/${id}/stop`, { method: "POST" }),
  restartContainer: (id: string) => request(`/api/docker/containers/${id}/restart`, { method: "POST" }),
  removeContainer: (id: string, force = true) =>
    request(`/api/docker/containers/${id}?force=${force}`, { method: "DELETE" }),
  containerLogsUrl: (id: string, follow = false) =>
    `${baseUrl}/api/docker/containers/${id}/logs?follow=${follow}&tail=200`,
  execContainer: (id: string, cmd?: string[]) =>
    request<{ output: string }>(`/api/docker/containers/${id}/exec`, {
      method: "POST",
      body: JSON.stringify({ cmd }),
    }),
  containerExecWsUrl: (id: string) =>
    `${baseUrl.replace(/^http/, "ws")}/api/docker/containers/${encodeURIComponent(id)}/exec/ws`,
  containerStats: (id: string) => request<ContainerStats>(`/api/docker/containers/${id}/stats`),
  containerStatsStreamUrl: (id: string) => `${baseUrl}/api/docker/containers/${id}/stats?stream=true`,
  bulkContainers: (ids: string[], action: "start" | "stop" | "restart" | "remove") =>
    request<{ ok: boolean; errors: string[] }>("/api/docker/containers/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),

  images: () => request<any[]>("/api/docker/images"),
  /** One-shot pull (buffers full stream). Prefer pullImageStream for console UI. */
  pullImage: (ref: string) =>
    request("/api/docker/images/pull", { method: "POST", body: JSON.stringify({ ref }) }),
  pullImageStream: async (ref: string, onChunk: (text: string) => void, signal?: AbortSignal) => {
    const res = await fetch(`${baseUrl}/api/docker/images/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
      signal,
    });
    if (!res.ok || !res.body) {
      let message = res.statusText;
      try {
        const body = await res.json();
        message = body.error || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  },
  removeImage: (id: string, force = true) =>
    request(`/api/docker/images/${encodeURIComponent(id)}?force=${force}`, { method: "DELETE" }),
  pruneImages: () => request("/api/docker/images/prune", { method: "POST" }),

  systemDf: () => request<DiskUsageSummary>("/api/docker/system/df"),
  systemPrune: (body: SystemPruneBody) =>
    request<SystemPruneResult>("/api/docker/system/prune", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  volumes: () => request<any[]>("/api/docker/volumes"),
  volume: (name: string) => request<any>(`/api/docker/volumes/${encodeURIComponent(name)}`),
  createVolume: (name: string) =>
    request("/api/docker/volumes", { method: "POST", body: JSON.stringify({ name }) }),
  removeVolume: (name: string, force = true) =>
    request(`/api/docker/volumes/${encodeURIComponent(name)}?force=${force}`, { method: "DELETE" }),

  networks: () => request<any[]>("/api/docker/networks"),
  network: (id: string) => request<any>(`/api/docker/networks/${encodeURIComponent(id)}`),
  createNetwork: (name: string, driver = "bridge") =>
    request<{ Id: string }>("/api/docker/networks", { method: "POST", body: JSON.stringify({ name, driver }) }),
  removeNetwork: (id: string) => request(`/api/docker/networks/${id}`, { method: "DELETE" }),

  composeProjects: () => request<ComposeProject[]>("/api/compose/projects"),
  composeDiscover: (roots: string[], maxDepth = 3) =>
    request<ComposeProject[]>("/api/compose/discover", {
      method: "POST",
      body: JSON.stringify({ roots, maxDepth }),
    }),
  composeUp: (body: ComposeBody) =>
    request<{ output: string }>("/api/compose/up", { method: "POST", body: JSON.stringify(body) }),
  composeDown: (body: ComposeBody) =>
    request<{ output: string }>("/api/compose/down", { method: "POST", body: JSON.stringify(body) }),
  composeRestart: (body: ComposeBody) =>
    request<{ output: string }>("/api/compose/restart", { method: "POST", body: JSON.stringify(body) }),
  composePs: (body: ComposeBody) =>
    request<{ output: string }>("/api/compose/ps", { method: "POST", body: JSON.stringify(body) }),

  k8sStatus: () => request<any>("/api/k8s/status"),
  k8sContexts: () => request<{ contexts: any[]; current: string }>("/api/k8s/contexts"),
  useContext: (name: string) =>
    request("/api/k8s/contexts", { method: "POST", body: JSON.stringify({ name }) }),
  namespaces: () => request<string[]>("/api/k8s/namespaces"),
  pods: (namespace: string) => request<any[]>(`/api/k8s/pods?namespace=${encodeURIComponent(namespace)}`),
  pod: (ns: string, name: string) => request<any>(`/api/k8s/pods/${ns}/${name}`),
  deletePod: (ns: string, name: string) => request(`/api/k8s/pods/${ns}/${name}`, { method: "DELETE" }),
  podLogsUrl: (ns: string, name: string, follow = false) =>
    `${baseUrl}/api/k8s/pods/${ns}/${name}/logs?follow=${follow}&tail=200`,
  execPod: (ns: string, name: string, cmd?: string[], container?: string) =>
    request<{ output: string }>(`/api/k8s/pods/${ns}/${name}/exec`, {
      method: "POST",
      body: JSON.stringify({ cmd, container }),
    }),
  podExecWsUrl: (ns: string, name: string, container?: string) => {
    const url = new URL(
      `${baseUrl.replace(/^http/, "ws")}/api/k8s/pods/${encodeURIComponent(ns)}/${encodeURIComponent(name)}/exec/ws`,
    );
    if (container) url.searchParams.set("container", container);
    return url.toString();
  },
  deployments: (namespace: string) =>
    request<any[]>(`/api/k8s/deployments?namespace=${encodeURIComponent(namespace)}`),
  scaleDeployment: (ns: string, name: string, replicas: number) =>
    request(`/api/k8s/deployments/${ns}/${name}/scale`, {
      method: "POST",
      body: JSON.stringify({ replicas }),
    }),
  restartDeployment: (ns: string, name: string) =>
    request(`/api/k8s/deployments/${ns}/${name}/restart`, { method: "POST" }),
  deleteDeployment: (ns: string, name: string) =>
    request(`/api/k8s/deployments/${ns}/${name}`, { method: "DELETE" }),

  helmReleases: (namespace: string, allNamespaces = false) =>
    request<any[]>(
      `/api/helm/releases?namespace=${encodeURIComponent(namespace)}&allNamespaces=${allNamespaces}`,
    ),
  helmInstall: (body: HelmBody) =>
    request("/api/helm/install", { method: "POST", body: JSON.stringify(body) }),
  helmUpgrade: (body: HelmBody) =>
    request("/api/helm/upgrade", { method: "POST", body: JSON.stringify(body) }),
  helmRollback: (namespace: string, name: string, revision = 0) =>
    request("/api/helm/rollback", {
      method: "POST",
      body: JSON.stringify({ namespace, name, revision }),
    }),
  helmUninstall: (ns: string, name: string) =>
    request(`/api/helm/releases/${ns}/${name}`, { method: "DELETE" }),

  runtimes: () => request<{ name: string; available: boolean }[]>("/api/runtimes"),
  listVMs: () => request<any[]>("/api/runtimes/firecracker/vms"),
  createVM: (body: any) =>
    request("/api/runtimes/firecracker/vms", { method: "POST", body: JSON.stringify(body) }),
  startVM: (id: string) => request(`/api/runtimes/firecracker/vms/${id}/start`, { method: "POST" }),
  stopVM: (id: string) => request(`/api/runtimes/firecracker/vms/${id}/stop`, { method: "POST" }),
  destroyVM: (id: string) => request(`/api/runtimes/firecracker/vms/${id}`, { method: "DELETE" }),
  vmLogs: (id: string) => request<{ output: string }>(`/api/runtimes/firecracker/vms/${id}/logs`),
};

export type StatusResponse = {
  docker: { connected: boolean; error?: string };
  kubernetes: { connected: boolean; version?: string; error?: string };
  firecracker: { available: boolean };
};

/** docker stats sample — https://docs.docker.com/engine/containers/runmetrics/ */
export type ContainerStats = {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
};

export type GPUDevice = {
  index: number;
  name: string;
  uuid: string;
  memoryUsedMiB: number;
  memoryTotalMiB: number;
  utilization: number;
  temperature: number;
};

export type GPUStatus = {
  available: boolean;
  runtime?: string;
  nvidiaSmi: boolean;
  toolkitHint?: string;
  devices: GPUDevice[];
  error?: string;
};

export type K8sEventItem = {
  type: string;
  reason: string;
  message: string;
  involved: string;
  count: number;
  lastTimestamp?: string;
};

/** Subscribe to Docker engine SSE events. Returns an unsubscribe fn. */
export function subscribeDockerEvents(onEvent: (event: any) => void, onError?: (err: Event) => void) {
  const es = new EventSource(api.dockerEventsUrl());
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      /* ignore malformed */
    }
  };
  es.onerror = (err) => {
    onError?.(err);
  };
  return () => es.close();
}

export type RunContainerBody = {
  image: string;
  name?: string;
  cmd?: string;
  env?: string[];
  ports?: string[];
  start?: boolean;
  gpu?: boolean;
  autoRemove?: boolean;
  restart?: "no" | "always" | "unless-stopped" | "on-failure" | "";
  workdir?: string;
  network?: string;
};

export type RunContainerResult = {
  id: string;
  warnings?: string[];
  started: boolean;
};

export type DiskUsageSummary = {
  layersSize: number;
  imagesSize: number;
  imagesTotal: number;
  imagesActive: number;
  containersSize: number;
  containersTotal: number;
  containersActive: number;
  volumesSize: number;
  volumesTotal: number;
  volumesActive: number;
  buildCacheSize: number;
  buildCacheTotal: number;
  buildCacheActive: number;
  reclaimable: number;
};

export type SystemPruneBody = {
  containers?: boolean;
  images?: boolean;
  volumes?: boolean;
  networks?: boolean;
  buildCache?: boolean;
};

export type SystemPruneResult = {
  spaceReclaimed: number;
  containersDeleted: number;
  imagesDeleted: number;
  volumesDeleted: number;
  networksDeleted: number;
  buildCachesDeleted: number;
  details?: Record<string, number>;
};

export type ComposeBody = {
  path?: string;
  configFiles?: string[];
  yaml?: string;
  projectName?: string;
};

export type ComposeProject = {
  name: string;
  path?: string;
  configFiles?: string[];
  status?: string;
  source?: "engine" | "scan" | string;
  running?: boolean;
};

export type HelmBody = {
  name: string;
  namespace: string;
  chart: string;
  version?: string;
  valuesYaml?: string;
  createNamespace?: boolean;
};
