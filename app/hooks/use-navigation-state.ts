import { appBasePath, appPath } from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";

import { TAB_ID } from "@/lib/tab-id";

/** Onglets de la fiche vidéo. */
export type StudioTab =
  | "map"
  | "markers"
  | "prep"
  | "experiments"
  | "publication";

export interface NavigationState {
  view: string;
  path?: string;
  threadId?: string;
  /** Vidéo ouverte, sur `/video/:id`. */
  videoId?: string;
  /** Onglet ouvert dans la fiche vidéo. */
  tab?: StudioTab;
  /** Étape narrative dont le panneau est déplié, 1-12. */
  step?: number;
  /** Section ouverte dans la bibliothèque. */
  section?: LibrarySection;
  /** Modèle en cours d'édition, sur la section « templates ». */
  templateId?: string;
}

/** Sections de la bibliothèque. */
export type LibrarySection =
  | "create"
  | "library"
  | "prompts"
  | "templates"
  | "starter"
  | "kits"
  | "journal";

const LIBRARY_SECTIONS: LibrarySection[] = [
  "create",
  "library",
  "prompts",
  "templates",
  "starter",
  "kits",
  "journal",
];

const STUDIO_TABS: StudioTab[] = [
  "map",
  "markers",
  "prep",
  "experiments",
  "publication",
];

export function useNavigationState() {
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname }) => {
      const threadId = threadIdFromPath(pathname);
      const videoId = videoIdFromPath(pathname);
      const tab = tabFromLocation();
      const step = stepFromLocation();
      const view = viewForPath(pathname);
      const section = view === "library" ? sectionFromLocation() : null;
      const templateId = view === "library" ? templateFromLocation() : null;
      return {
        view: viewForPath(pathname),
        path: appPath(pathname),
        ...(threadId ? { threadId } : {}),
        ...(videoId ? { videoId } : {}),
        ...(videoId && tab ? { tab } : {}),
        ...(videoId && step ? { step } : {}),
        ...(section ? { section } : {}),
        ...(templateId ? { templateId } : {}),
      };
    },
    getCommandPath: (command) =>
      routerPath(command.path || pathForCommand(command)),
  });
}

function threadIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  } catch {
    return null;
  }
}

function videoIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/video\/([^/]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return null;
  }
}

/**
 * L'onglet et l'étape vivent dans la query string, pas dans le chemin : la fiche vidéo
 * reste une seule route (FR-020), et un lien profond vers un onglet reste partageable.
 */
function tabFromLocation(): StudioTab | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("tab");
  return STUDIO_TABS.includes(raw as StudioTab) ? (raw as StudioTab) : null;
}

function stepFromLocation(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("step");
  const step = Number(raw);
  return Number.isInteger(step) && step >= 1 && step <= 12 ? step : null;
}

function sectionFromLocation(): LibrarySection | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("section");
  return LIBRARY_SECTIONS.includes(raw as LibrarySection)
    ? (raw as LibrarySection)
    : "library";
}

function templateFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("template");
}

function viewForPath(pathname: string): string {
  if (pathname.startsWith("/videos")) return "list";
  if (pathname.startsWith("/video/")) return "video";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/library")) return "library";
  if (isChatPath(pathname)) return "chat";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/settings/agent") || pathname.startsWith("/agent")) {
    return "agent";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/team")) return "settings";
  return "chat";
}

function pathForView(view?: string): string {
  switch (view) {
    case "list":
    case "videos":
      return "/videos";
    case "calendar":
      return "/calendar";
    case "library":
      return "/library";
    case "chat":
    case "home":
    case "ask":
      return "/home";
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/settings/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings/organization";
    default:
      return "/home";
  }
}

function pathForCommand(command: any): string {
  if (command?.view === "library") {
    const params = new URLSearchParams();
    if (typeof command.section === "string") params.set("section", command.section);
    if (typeof command.templateId === "string") params.set("template", command.templateId);
    const query = params.toString();
    return `/library${query ? `?${query}` : ""}`;
  }
  if (command?.view === "video" && typeof command?.videoId === "string") {
    const params = new URLSearchParams();
    if (typeof command.tab === "string") params.set("tab", command.tab);
    if (Number.isInteger(command.step)) params.set("step", String(command.step));
    const query = params.toString();
    return `/video/${encodeURIComponent(command.videoId)}${query ? `?${query}` : ""}`;
  }
  const path = pathForView(command?.view);
  if (path !== "/home") return path;
  const threadId =
    typeof command?.threadId === "string" ? command.threadId.trim() : "";
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : path;
}

function routerPath(path: string): string {
  const basePath = appBasePath();
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || "/";
  }
  return path;
}

function isChatPath(pathname: string): boolean {
  return pathname === "/home" || pathname.startsWith("/chat/");
}
