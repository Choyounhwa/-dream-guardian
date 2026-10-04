import { bootEditor } from "./UIEditorShell";
import { mountShell, type ShellInstance } from "./view/UIShellView";

export type EditorApp = ReturnType<typeof bootEditor> & {
  instance: ShellInstance | null;
  unmount: () => void;
};

export function start(container?: HTMLElement | null): EditorApp {
  const shell = bootEditor();
  const root =
    container ??
    (typeof document !== "undefined" ? document.getElementById("app") : null);

  let instance: ShellInstance | null = null;
  if (root) {
    root.dataset.panels = shell.panels.join(",");
    instance = mountShell(root);
  }

  return {
    ...shell,
    instance,
    unmount: () => {
      instance?.unmount();
    },
  };
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) {
    start(root);
  }
}
