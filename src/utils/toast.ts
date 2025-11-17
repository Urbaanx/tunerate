export type ToastType = "success" | "error" | "info" | "default";

const CONTAINER_ID = "__app_toast_container__";

function ensureContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    c = document.createElement("div");
    c.id = CONTAINER_ID;
    c.className =
      "fixed right-6 bottom-6 flex flex-col-reverse items-end space-y-2 space-y-reverse z-50 pointer-events-none";
    document.body.appendChild(c);
  }
  return c;
}

export function toast(
  message: string,
  type: ToastType = "default",
  timeoutMs = 4000
) {
  if (typeof document === "undefined") {
    console[type === "error" ? "error" : "log"](message);
    return;
  }

  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = [
    "max-w-sm pointer-events-auto px-4 py-2 rounded-lg shadow-lg text-sm text-white transform transition-all duration-200 ease-out",
    type === "success" ? "bg-green-600" : "",
    type === "error" ? "bg-red-600" : "",
    type === "info" ? "bg-blue-600" : "",
    type === "default" ? "bg-gray-800" : "",
  ].join(" ");
  el.style.opacity = "0";
  el.style.marginTop = "8px";
  el.textContent = message;

  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  const remove = () => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      if (
        container &&
        container.childElementCount === 0 &&
        container.parentElement
      ) {
        container.parentElement.removeChild(container);
      }
    }, 200);
  };

  const t = setTimeout(remove, timeoutMs);

  el.addEventListener("click", () => {
    clearTimeout(t);
    remove();
  });
}
