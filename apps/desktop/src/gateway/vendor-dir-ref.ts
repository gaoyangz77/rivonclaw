let _vendorDir: string | null = null;

export function setVendorDir(dir: string | null): void {
  _vendorDir = dir;
}

export function getVendorDir(): string | null {
  return _vendorDir;
}
