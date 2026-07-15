export const GATEWAY_PERFORMANCE_SAMPLE_PREFIX = "[desktop-perf-sample] ";

export type GatewayPerformanceSample = {
  ts: number;
  intervalMs: number;
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
};

export type GatewayPerformanceTrigger = {
  ts: number;
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

export type GatewayPerformanceBurst = {
  version: 1;
  completedAt: number;
  completionReason: "post_window_complete" | "post_window_timeout" | "gateway_exit";
  trigger: GatewayPerformanceTrigger;
  additionalTriggerCount: number;
  preSamples: GatewayPerformanceSample[];
  postSamples: GatewayPerformanceSample[];
};

type ActiveCapture = {
  trigger: GatewayPerformanceTrigger;
  additionalTriggerCount: number;
  preSamples: GatewayPerformanceSample[];
  postSamples: GatewayPerformanceSample[];
};

type GatewayPerformanceCaptureOptions = {
  emit: (burst: GatewayPerformanceBurst) => void;
  onSamplerReady?: (sample: GatewayPerformanceSample) => void;
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

function readMetric(line: string, name: string): number | undefined {
  const match = line.match(new RegExp(`(?:^|\\s)${name}=([0-9.]+)(?:\\s|$)`));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseGatewayPerformanceTrigger(line: string): GatewayPerformanceTrigger | null {
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
  private readonly preSampleCount: number;
  private readonly postSampleCount: number;
  private readonly postTimeoutMs: number;
  private samples: GatewayPerformanceSample[] = [];
  private activeCapture: ActiveCapture | null = null;
  private captureTimeout: ReturnType<typeof setTimeout> | null = null;
  private samplerReady = false;

  constructor(options: GatewayPerformanceCaptureOptions) {
    this.emit = options.emit;
    this.onSamplerReady = options.onSamplerReady;
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

    const trigger = parseGatewayPerformanceTrigger(line);
    if (trigger) this.startCapture(trigger);
    return false;
  }

  flushOnGatewayExit(): void {
    if (this.activeCapture) this.finishCapture("gateway_exit");
  }

  reset(): void {
    if (this.captureTimeout) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    this.activeCapture = null;
    this.samples = [];
    this.samplerReady = false;
  }

  private recordSample(sample: GatewayPerformanceSample): void {
    if (!this.samplerReady) {
      this.samplerReady = true;
      this.onSamplerReady?.(sample);
    }

    this.samples.push(sample);
    if (this.samples.length > this.preSampleCount) this.samples.shift();

    if (!this.activeCapture) return;
    this.activeCapture.postSamples.push(sample);
    if (this.activeCapture.postSamples.length >= this.postSampleCount) {
      this.finishCapture("post_window_complete");
    }
  }

  private startCapture(trigger: GatewayPerformanceTrigger): void {
    if (this.activeCapture) {
      this.activeCapture.additionalTriggerCount++;
      return;
    }

    this.activeCapture = {
      trigger,
      additionalTriggerCount: 0,
      preSamples: [...this.samples],
      postSamples: [],
    };
    this.captureTimeout = setTimeout(() => {
      if (this.activeCapture) this.finishCapture("post_window_timeout");
    }, this.postTimeoutMs);
    this.captureTimeout.unref?.();
  }

  private finishCapture(completionReason: GatewayPerformanceBurst["completionReason"]): void {
    const capture = this.activeCapture;
    if (!capture) return;

    if (this.captureTimeout) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    this.activeCapture = null;
    this.emit({
      version: 1,
      completedAt: Date.now(),
      completionReason,
      ...capture,
    });
  }
}
