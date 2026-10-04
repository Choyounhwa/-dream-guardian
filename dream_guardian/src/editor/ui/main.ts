import { bootEditor } from "./UIEditorShell";

export function start(): ReturnType<typeof bootEditor> {
  return bootEditor();
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) {
    const shell = start();
    root.dataset.panels = shell.panels.join(",");
  }
}
