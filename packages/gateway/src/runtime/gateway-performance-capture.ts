export const GATEWAY_PERFORMANCE_SAMPLE_PREFIX = "[desktop-perf-sample] ";
export const GATEWAY_PERFORMANCE_TRIGGER_PREFIX = "[desktop-perf-trigger] ";
export const GATEWAY_PERFORMANCE_PROFILE_PREFIX = "[desktop-perf-profile] ";

export type GatewayProcessIdentity = {
  pid: number;
  ppid: number;
  threadId: number;
  isMainThread: boolean;
  role: string;
  title: string;
  execPath: string;
  argv: string[];
};

export type GatewayPerformanceSample = {
  ts: number;
  intervalMs: number;
  process?: GatewayProcessIdentity;
  cpu: {
    userMs: number;
    systemMs: number;
    coreRatio: number;
  };
  eventLoop: {
    utilization: number;
    p99Ms: number;
    maxMs: number;
  };
  memory: {
    rssBytes: number;
    heapTotalBytes?: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  gc: {
    count: number;
    totalMs: number;
    maxMs: number;
    minor: number;
    major: number;
    incremental: number;
    weakCallback: number;
    unknown: number;
  };
  heap?: {
    totalHeapSizeBytes: number;
    totalAvailableSizeBytes: number;
    heapSizeLimitBytes: number;
    mallocedMemoryBytes: number;
    peakMallocedMemoryBytes: number;
    nativeContexts: number;
    detachedContexts: number;
  };
  resource?: {
    maxRssBytes: number;
    minorPageFaultDelta: number;
    majorPageFaultDelta: number;
    fsReadDelta: number;
    fsWriteDelta: number;
    voluntaryContextSwitchDelta: number;
    involuntaryContextSwitchDelta: number;
  };
  activity?: {
    activeHandles: number;
    activeRequests: number;
    resources: Record<string, number>;
  };
};

export type GatewayPerformanceTrigger = {
  ts: number;
  pid?: number;
  ppid?: number;
  threadId?: number;
  role?: string;
  exactProcess?: boolean;
  reasons?: string;
  eventLoopDelayP99Ms?: number;
  eventLoopDelayMaxMs?: number;
  eventLoopUtilization?: number;
  cpuCoreRatio?: number;
  active?: number;
  waiting?: number;
  queued?: number;
  work?: string;
};

export type GatewayCpuProfile = {
  pid: number;
  startedAt: number;
  durationMs: number;
  sampleCount: number;
  timeDeltaUs: number;
  top: Array<{
    functionName: string;
    url: string;
    lineNumber: number;
    selfMs: number;
    sampleCount: number;
  }>;
  error?: string;
};

export type GatewayProcessTreeSnapshot = {
  ts: number;
  platform: NodeJS.Platform;
  rootPid?: number;
  targetPid?: number;
  rows: Array<{
    pid: number;
    ppid: number;
    cpuPercent?: number;
    memoryPercent?: number;
    rssBytes?: number;
    virtualBytes?: number;
    state?: string;
    elapsed?: string;
    threadCount?: number;
    command?: string;
  }>;
  error?: string;
};

export type GatewayPerformanceBurst = {
  version: 2;
  completedAt: number;
  completionReason: "post_window_complete" | "post_window_timeout" | "gateway_exit";
  trigger: GatewayPerformanceTrigger;
  additionalTriggerCount: number;
  preSamples: GatewayPerformanceSample[];
  postSamples: GatewayPerformanceSample[];
  observedProcesses: GatewayProcessIdentity[];
  cpuProfiles: GatewayCpuProfile[];
  processTree?: GatewayProcessTreeSnapshot;
};

type ActiveCapture = {
  trigger: GatewayPerformanceTrigger;
  additionalTriggerCount: number;
  preSamples: GatewayPerformanceSample[];
  postSamples: GatewayPerformanceSample[];
  cpuProfiles: GatewayCpuProfile[];
  processTree?: GatewayProcessTreeSnapshot;
};

type GatewayPerformanceCaptureOptions = {
  emit: (burst: GatewayPerformanceBurst) => void;
  onSamplerReady?: (sample: GatewayPerformanceSample) => void;
  onTrigger?: (trigger: GatewayPerformanceTrigger) => void;
  preSampleCount?: number;
  postSampleCount?: number;
  postTimeoutMs?: number;
};

const LIVENESS_WARNING_MARKER = "[diagnostic] liveness warning:";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasFiniteFields(value: unknown, fields: string[]): value is Record<string, number> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return fields.every((field) => isFiniteNumber(record[field]));
}

export function parseGatewayPerformanceSample(line: string): GatewayPerformanceSample | null {
  if (!line.startsWith(GATEWAY_PERFORMANCE_SAMPLE_PREFIX)) return null;

  try {
    const value = JSON.parse(line.slice(GATEWAY_PERFORMANCE_SAMPLE_PREFIX.length)) as Record<
      string,
      unknown
    >;
    if (!isFiniteNumber(value.ts) || !isFiniteNumber(value.intervalMs)) return null;
    if (!hasFiniteFields(value.cpu, ["userMs", "systemMs", "coreRatio"])) return null;
    if (!hasFiniteFields(value.eventLoop, ["utilization", "p99Ms", "maxMs"])) return null;
    if (
      !hasFiniteFields(value.memory, [
        "rssBytes",
        "heapUsedBytes",
        "externalBytes",
        "arrayBuffersBytes",
      ])
    ) {
      return null;
    }
    if (
      !hasFiniteFields(value.gc, [
        "count",
        "totalMs",
        "maxMs",
        "minor",
        "major",
        "incremental",
        "weakCallback",
        "unknown",
      ])
    ) {
      return null;
    }
    return value as GatewayPerformanceSample;
  } catch {
    return null;
  }
}

export function parseGatewayCpuProfile(line: string): GatewayCpuProfile | null {
  if (!line.startsWith(GATEWAY_PERFORMANCE_PROFILE_PREFIX)) return null;
  try {
    const value = JSON.parse(line.slice(GATEWAY_PERFORMANCE_PROFILE_PREFIX.length)) as Record<
      string,
      unknown
    >;
    if (
      !isFiniteNumber(value.pid) ||
      !isFiniteNumber(value.startedAt) ||
      !isFiniteNumber(value.durationMs) ||
      !isFiniteNumber(value.sampleCount) ||
      !isFiniteNumber(value.timeDeltaUs) ||
      !Array.isArray(value.top)
    ) {
      return null;
    }
    return value as GatewayCpuProfile;
  } catch {
    return null;
  }
}

function readMetric(line: string, name: string): number | undefined {
  const match = line.match(new RegExp(`(?:^|\\s)${name}=([0-9.]+)(?:\\s|$)`));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseGatewayPerformanceTrigger(line: string): GatewayPerformanceTrigger | null {
  if (line.startsWith(GATEWAY_PERFORMANCE_TRIGGER_PREFIX)) {
    try {
      const value = JSON.parse(line.slice(GATEWAY_PERFORMANCE_TRIGGER_PREFIX.length)) as Record<
        string,
        unknown
      >;
      const warning = typeof value.warning === "string" ? value.warning : "";
      if (!isFiniteNumber(value.pid) || !warning.includes(LIVENESS_WARNING_MARKER)) return null;
      const parsed = parseLivenessWarning(warning);
      if (!parsed) return null;
      return {
        ...parsed,
        ts: isFiniteNumber(value.ts) ? value.ts : Date.now(),
        pid: value.pid,
        ...(isFiniteNumber(value.ppid) ? { ppid: value.ppid } : {}),
        ...(isFiniteNumber(value.threadId) ? { threadId: value.threadId } : {}),
        ...(typeof value.role === "string" ? { role: value.role } : {}),
        exactProcess: true,
      };
    } catch {
      return null;
    }
  }

  return parseLivenessWarning(line);
}

function parseLivenessWarning(line: string): GatewayPerformanceTrigger | null {
  if (!line.includes(LIVENESS_WARNING_MARKER)) return null;

  const reasons = line.match(/(?:^|\s)reasons=([^\s]+)/)?.[1];
  const work = line.match(/(?:^|\s)work=\[(.*)\]\s*$/)?.[1];
  return {
    ts: Date.now(),
    ...(reasons ? { reasons } : {}),
    eventLoopDelayP99Ms: readMetric(line, "eventLoopDelayP99Ms"),
    eventLoopDelayMaxMs: readMetric(line, "eventLoopDelayMaxMs"),
    eventLoopUtilization: readMetric(line, "eventLoopUtilization"),
    cpuCoreRatio: readMetric(line, "cpuCoreRatio"),
    active: readMetric(line, "active"),
    waiting: readMetric(line, "waiting"),
    queued: readMetric(line, "queued"),
    ...(work ? { work: work.slice(0, 1_000) } : {}),
  };
}

export class GatewayPerformanceCapture {
  private readonly emit: (burst: GatewayPerformanceBurst) => void;
  private readonly onSamplerReady?: (sample: GatewayPerformanceSample) => void;
  private readonly onTrigger?: (trigger: GatewayPerformanceTrigger) => void;
  private readonly preSampleCount: number;
  private readonly postSampleCount: number;
  private readonly postTimeoutMs: number;
  private samplesByPid = new Map<number, GatewayPerformanceSample[]>();
  private latestProcessByPid = new Map<number, GatewayProcessIdentity>();
  private activeCapture: ActiveCapture | null = null;
  private captureTimeout: ReturnType<typeof setTimeout> | null = null;
  private samplerReadyPids = new Set<number>();

  constructor(options: GatewayPerformanceCaptureOptions) {
    this.emit = options.emit;
    this.onSamplerReady = options.onSamplerReady;
    this.onTrigger = options.onTrigger;
    this.preSampleCount = options.preSampleCount ?? 12;
    this.postSampleCount = options.postSampleCount ?? 4;
    this.postTimeoutMs = options.postTimeoutMs ?? 30_000;
  }

  /** Consume internal sampler lines while leaving ordinary Gateway stderr visible. */
  consumeStderrLine(line: string): boolean {
    if (line.startsWith(GATEWAY_PERFORMANCE_SAMPLE_PREFIX)) {
      const sample = parseGatewayPerformanceSample(line);
      if (sample) this.recordSample(sample);
      return true;
    }

    if (line.startsWith(GATEWAY_PERFORMANCE_PROFILE_PREFIX)) {
      const profile = parseGatewayCpuProfile(line);
      if (profile) this.recordCpuProfile(profile);
      return true;
    }

    if (line.startsWith(GATEWAY_PERFORMANCE_TRIGGER_PREFIX)) {
      const trigger = parseGatewayPerformanceTrigger(line);
      if (trigger) this.startCapture(trigger);
      return true;
    }

    const trigger = parseGatewayPerformanceTrigger(line);
    if (trigger && !this.activeCapture) this.startCapture(trigger);
    return false;
  }

  attachProcessTree(snapshot: GatewayProcessTreeSnapshot): void {
    if (this.activeCapture) this.activeCapture.processTree = snapshot;
  }

  flushOnGatewayExit(): void {
    if (this.activeCapture) this.finishCapture("gateway_exit");
  }

  reset(): void {
    if (this.captureTimeout) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    this.activeCapture = null;
    this.samplesByPid.clear();
    this.latestProcessByPid.clear();
    this.samplerReadyPids.clear();
  }

  private recordSample(sample: GatewayPerformanceSample): void {
    const pid = sample.process?.pid ?? 0;
    if (!this.samplerReadyPids.has(pid)) {
      this.samplerReadyPids.add(pid);
      this.onSamplerReady?.(sample);
    }

    const samples = this.samplesByPid.get(pid) ?? [];
    samples.push(sample);
    if (samples.length > this.preSampleCount) samples.shift();
    this.samplesByPid.set(pid, samples);
    if (sample.process) this.latestProcessByPid.set(pid, sample.process);

    if (!this.activeCapture) return;
    if (this.activeCapture.trigger.pid !== undefined && pid !== this.activeCapture.trigger.pid) {
      return;
    }
    this.activeCapture.postSamples.push(sample);
    if (this.activeCapture.postSamples.length >= this.postSampleCount) {
      this.finishCapture("post_window_complete");
    }
  }

  private startCapture(trigger: GatewayPerformanceTrigger): void {
    if (this.activeCapture) {
      if (
        trigger.exactProcess &&
        !this.activeCapture.trigger.exactProcess &&
        this.activeCapture.postSamples.length === 0
      ) {
        this.activeCapture.trigger = trigger;
        this.activeCapture.preSamples = [...(this.samplesByPid.get(trigger.pid ?? 0) ?? [])];
        this.onTrigger?.(trigger);
        return;
      }
      this.activeCapture.additionalTriggerCount++;
      return;
    }

    const preSamples =
      trigger.pid !== undefined
        ? [...(this.samplesByPid.get(trigger.pid) ?? [])]
        : [...(this.samplesByPid.get(0) ?? [])];
    this.activeCapture = {
      trigger,
      additionalTriggerCount: 0,
      preSamples,
      postSamples: [],
      cpuProfiles: [],
    };
    this.onTrigger?.(trigger);
    this.captureTimeout = setTimeout(() => {
      if (this.activeCapture) this.finishCapture("post_window_timeout");
    }, this.postTimeoutMs);
    this.captureTimeout.unref?.();
  }

  private recordCpuProfile(profile: GatewayCpuProfile): void {
    if (!this.activeCapture) return;
    if (
      this.activeCapture.trigger.pid !== undefined &&
      profile.pid !== this.activeCapture.trigger.pid
    ) {
      return;
    }
    this.activeCapture.cpuProfiles.push(profile);
  }

  private finishCapture(completionReason: GatewayPerformanceBurst["completionReason"]): void {
    const capture = this.activeCapture;
    if (!capture) return;

    if (this.captureTimeout) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    this.activeCapture = null;
    this.emit({
      version: 2,
      completedAt: Date.now(),
      completionReason,
      observedProcesses: [...this.latestProcessByPid.values()],
      ...capture,
    });
  }
}
