import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GATEWAY_PERFORMANCE_SAMPLE_PREFIX,
  GATEWAY_PERFORMANCE_PROFILE_PREFIX,
  GATEWAY_PERFORMANCE_TRIGGER_PREFIX,
  GatewayPerformanceCapture,
  parseGatewayCpuProfile,
  parseGatewayPerformanceSample,
  parseGatewayPerformanceTrigger,
  type GatewayPerformanceSample,
} from "./gateway-performance-capture.js";

function sample(ts: number, coreRatio = 0.5): GatewayPerformanceSample {
  return {
    ts,
    intervalMs: 5_000,
    process: {
      pid: 123,
      ppid: 100,
      threadId: 0,
      isMainThread: true,
      role: "gateway",
      title: "node",
      execPath: "/usr/bin/node",
      argv: ["node", "openclaw", "gateway"],
    },
    cpu: { userMs: 2_000, systemMs: 500, coreRatio },
    eventLoop: { utilization: 0.4, p99Ms: 20, maxMs: 40 },
    memory: {
      rssBytes: 1_000_000,
      heapUsedBytes: 800_000,
      externalBytes: 100_000,
      arrayBuffersBytes: 50_000,
    },
    gc: {
      count: 2,
      totalMs: 4,
      maxMs: 3,
      minor: 2,
      major: 0,
      incremental: 0,
      weakCallback: 0,
      unknown: 0,
    },
  };
}

function sampleLine(value: GatewayPerformanceSample): string {
  return `${GATEWAY_PERFORMANCE_SAMPLE_PREFIX}${JSON.stringify(value)}`;
}

const warningLine =
  "2026-07-15 [diagnostic] liveness warning: reasons=event_loop_delay,cpu " +
  "eventLoopDelayP99Ms=1006.1 eventLoopDelayMaxMs=1389.4 " +
  "eventLoopUtilization=0.817 cpuCoreRatio=1.924 active=1 waiting=0 queued=2 " +
  "work=[active=agent:main:feishu:group:abc(processing/model_call,q=1)]";

const exactTriggerLine = `${GATEWAY_PERFORMANCE_TRIGGER_PREFIX}${JSON.stringify({
  ts: 1_000,
  pid: 123,
  ppid: 100,
  threadId: 0,
  role: "gateway",
  warning: warningLine,
})}`;

describe("GatewayPerformanceCapture", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses sampler and liveness lines", () => {
    expect(parseGatewayPerformanceSample(sampleLine(sample(1000)))).toEqual(sample(1000));
    expect(
      parseGatewayPerformanceSample(`${GATEWAY_PERFORMANCE_SAMPLE_PREFIX}{bad json`),
    ).toBeNull();

    expect(parseGatewayPerformanceTrigger(warningLine)).toEqual(
      expect.objectContaining({
        reasons: "event_loop_delay,cpu",
        eventLoopDelayP99Ms: 1006.1,
        eventLoopDelayMaxMs: 1389.4,
        eventLoopUtilization: 0.817,
        cpuCoreRatio: 1.924,
        active: 1,
        waiting: 0,
        queued: 2,
        work: "active=agent:main:feishu:group:abc(processing/model_call,q=1)",
      }),
    );
    expect(parseGatewayPerformanceTrigger(exactTriggerLine)).toEqual(
      expect.objectContaining({
        ts: 1_000,
        pid: 123,
        ppid: 100,
        exactProcess: true,
        cpuCoreRatio: 1.924,
      }),
    );

    const profile = {
      pid: 123,
      startedAt: 1_000,
      durationMs: 10_000,
      sampleCount: 50,
      timeDeltaUs: 10_000_000,
      top: [],
    };
    expect(
      parseGatewayCpuProfile(`${GATEWAY_PERFORMANCE_PROFILE_PREFIX}${JSON.stringify(profile)}`),
    ).toEqual(profile);
  });

  it("keeps a bounded pre-window and emits after the post-window", () => {
    const emit = vi.fn();
    const onSamplerReady = vi.fn();
    const capture = new GatewayPerformanceCapture({
      emit,
      onSamplerReady,
      preSampleCount: 2,
      postSampleCount: 2,
    });

    expect(capture.consumeStderrLine(sampleLine(sample(1)))).toBe(true);
    capture.consumeStderrLine(sampleLine(sample(2)));
    capture.consumeStderrLine(sampleLine(sample(3)));
    expect(onSamplerReady).toHaveBeenCalledOnce();
    expect(onSamplerReady).toHaveBeenCalledWith(sample(1));
    expect(capture.consumeStderrLine(exactTriggerLine)).toBe(true);
    capture.consumeStderrLine(sampleLine(sample(4)));
    expect(emit).not.toHaveBeenCalled();
    capture.consumeStderrLine(sampleLine(sample(5)));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        completionReason: "post_window_complete",
        preSamples: [sample(2), sample(3)],
        postSamples: [sample(4), sample(5)],
      }),
    );
  });

  it("flushes a partial capture when the gateway exits", () => {
    const emit = vi.fn();
    const capture = new GatewayPerformanceCapture({ emit, postSampleCount: 4 });
    capture.consumeStderrLine(sampleLine(sample(1)));
    capture.consumeStderrLine(exactTriggerLine);
    capture.consumeStderrLine(sampleLine(sample(2)));

    capture.flushOnGatewayExit();

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        completionReason: "gateway_exit",
        preSamples: [sample(1)],
        postSamples: [sample(2)],
      }),
    );
  });

  it("correlates samples and CPU profiles with the exact warning process", () => {
    const emit = vi.fn();
    const onSamplerReady = vi.fn();
    const capture = new GatewayPerformanceCapture({ emit, onSamplerReady, postSampleCount: 1 });
    const other = sample(1);
    other.process = { ...other.process!, pid: 456 };
    capture.consumeStderrLine(sampleLine(other));
    capture.consumeStderrLine(sampleLine(sample(2)));
    expect(onSamplerReady).toHaveBeenCalledTimes(2);
    capture.consumeStderrLine(exactTriggerLine);

    const profile = {
      pid: 123,
      startedAt: 1_000,
      durationMs: 10_000,
      sampleCount: 50,
      timeDeltaUs: 10_000_000,
      top: [],
    };
    capture.consumeStderrLine(`${GATEWAY_PERFORMANCE_PROFILE_PREFIX}${JSON.stringify(profile)}`);
    capture.consumeStderrLine(sampleLine(sample(3)));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        preSamples: [sample(2)],
        postSamples: [sample(3)],
        cpuProfiles: [profile],
        observedProcesses: expect.arrayContaining([
          expect.objectContaining({ pid: 123 }),
          expect.objectContaining({ pid: 456 }),
        ]),
      }),
    );
  });

  it("emits a partial capture if post samples stop arriving", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const capture = new GatewayPerformanceCapture({
      emit,
      postSampleCount: 4,
      postTimeoutMs: 100,
    });
    capture.consumeStderrLine(sampleLine(sample(1)));
    capture.consumeStderrLine(exactTriggerLine);

    vi.advanceTimersByTime(100);

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        completionReason: "post_window_timeout",
        preSamples: [sample(1)],
        postSamples: [],
      }),
    );
  });
});
