export const GATEWAY_STOP_MESSAGE = "rivonclaw:gateway:stop";
export const GATEWAY_STOP_GRACE_MS = 30_000;

// Only the direct child receives the parent's private IPC channel. Inherited
// NODE_OPTIONS must not install a shutdown handler in workers or tool children.
export const GATEWAY_CONTROL_PRELOAD = `"use strict";
if (process.send && process.connected &&
    String(process.ppid) === process.env.RIVONCLAW_GATEWAY_PARENT_PID) {
  let requested = false;
  const deliverStop = () => {
    if (process.listenerCount("SIGTERM") > 0) {
      process.emit("SIGTERM");
    } else {
      // A stop can arrive before OpenClaw has installed its startup handlers.
      // The Desktop watchdog still bounds the entire shutdown request.
      setTimeout(deliverStop, 25).unref();
    }
  };
  process.on("message", message => {
    if (!message || message.type !== ${JSON.stringify(GATEWAY_STOP_MESSAGE)} || requested) return;
    requested = true;
    deliverStop();
  });
}
`;
