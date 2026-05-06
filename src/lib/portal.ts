let portalRoot: HTMLElement | null = null;

export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;

  if (portalRoot && document.body.contains(portalRoot)) {
    return portalRoot;
  }

  const existing = document.getElementById("app-portal-root");
  if (existing) {
    portalRoot = existing;
    return portalRoot;
  }

  const created = document.createElement("div");
  created.id = "app-portal-root";
  document.body.appendChild(created);
  portalRoot = created;
  return portalRoot;
}
