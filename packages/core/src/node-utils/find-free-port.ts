/**
 * Ask the OS to assign a free ephemeral port.
 * Binds a temporary server on port 0 to 127.0.0.1, reads the assigned port,
 * then closes the server and returns the port number.
 *
 * Node.js-only — depends on `node:net`.
 */
export async function findFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
