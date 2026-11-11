const permissionDefinitions = [
  { name: "Camera", descriptor: "camera", request: requestCamera },
  { name: "Microphone", descriptor: "microphone", request: requestMicrophone },
  {
    name: "Geolocation",
    descriptor: "geolocation",
    request: requestGeolocation,
  },
  {
    name: "Notifications",
    descriptor: "notifications",
    request: requestNotifications,
  },
  {
    name: "Clipboard",
    descriptor: "clipboard-read",
    request: requestClipboard,
  },
  { name: "MIDI", descriptor: "midi", request: requestMidi },
  { name: "Bluetooth", descriptor: null, request: requestBluetooth },
  { name: "USB", descriptor: null, request: requestUsb },
  { name: "Serial", descriptor: null, request: requestSerial },
  { name: "HID", descriptor: null, request: requestHid },
];
const grid = document.getElementById("permission-grid");
const toastStack = document.getElementById("toast-stack");
const dialog = document.getElementById("confirm-dialog");
let pendingConfirm = null;

function showToast(type, title, message) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const dot = document.createElement("span");
  dot.className = "toast-indicator";
  const body = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = message;
  body.append(heading, text);
  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close notification");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());
  toast.append(dot, body, close);
  toastStack.append(toast);
  setTimeout(() => toast.remove(), 6500);
}
function confirmAction(title, message) {
  return new Promise((resolve) => {
    pendingConfirm = resolve;
    document.getElementById("dialog-title").textContent = title;
    document.getElementById("dialog-message").textContent = message;
    dialog.showModal();
  });
}
dialog.addEventListener("close", () => {
  if (pendingConfirm) {
    pendingConfirm(dialog.returnValue === "confirm");
    pendingConfirm = null;
  }
});
function setPermissionStatus(name, status) {
  const el = document.querySelector(`[data-permission="${name}"]`);
  if (el) {
    el.textContent = status;
    el.dataset.status = status;
  }
}
function apiSupport(def) {
  if (def.descriptor) {
    return !!navigator.permissions?.query;
  }
  const map = {
    Bluetooth: "bluetooth",
    USB: "usb",
    Serial: "serial",
    HID: "hid",
  };
  return !!navigator[map[def.name]];
}
function renderPermission(def) {
  const card = document.createElement("article");
  card.className = "permission-card";
  const top = document.createElement("div");
  top.className = "permission-top";
  const title = document.createElement("h3");
  title.textContent = def.name;
  const status = document.createElement("span");
  status.className = "status-dot";
  status.setAttribute("aria-hidden", "true");
  top.append(title, status);
  const state = document.createElement("p");
  state.className = "permission-status";
  state.dataset.permission = def.name;
  state.textContent = apiSupport(def) ? "Unknown" : "Unsupported";
  state.dataset.status = state.textContent;
  const button = document.createElement("button");
  button.className = "button";
  button.type = "button";
  button.textContent = "Request permission";
  button.addEventListener("click", () => runPermission(def, button));
  if (!apiSupport(def)) button.disabled = true;
  card.append(top, state, button);
  grid.append(card);
  if (def.descriptor && apiSupport(def)) readPermission(def);
}
async function readPermission(def) {
  try {
    const result = await navigator.permissions.query({ name: def.descriptor });
    setPermissionStatus(def.name, normalizeState(result.state));
    result.addEventListener?.("change", () =>
      setPermissionStatus(def.name, normalizeState(result.state)),
    );
  } catch {
    setPermissionStatus(def.name, apiSupport(def) ? "Unknown" : "Unsupported");
  }
}
function normalizeState(state) {
  return (
    { granted: "Granted", denied: "Denied", prompt: "Prompt" }[state] ||
    "Unknown"
  );
}
async function runPermission(def, button) {
  button.disabled = true;
  try {
    const result = await def.request();
    if (result && result.permissionStatus) {
      setPermissionStatus(def.name, result.permissionStatus);
      showToast(result.type, result.title, result.message);
    } else {
      const state = result?.state || "Granted";
      setPermissionStatus(def.name, normalizeState(state));
      showToast(
        state === "denied" ? "error" : "success",
        `${def.name} ${normalizeState(state).toLowerCase()}`,
        result?.message || `${def.name} permission request completed.`,
      );
    }
  } catch (error) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      setPermissionStatus(def.name, "Denied");
      showToast(
        "warning",
        `${def.name} denied`,
        error.message || "The request was denied or dismissed.",
      );
    } else if (error.name === "NotFoundError") {
      showToast(
        "warning",
        `${def.name} unavailable`,
        error.message || "No matching device was found.",
      );
    } else {
      showToast(
        "error",
        `${def.name} request failed`,
        error.message || "The browser could not complete this request.",
      );
    }
  } finally {
    button.disabled = !apiSupport(def);
  }
}
async function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "Camera access is not supported in this browser or context.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  stream.getTracks().forEach((track) => track.stop());
  return {
    state: "Granted",
    message: "Camera access was granted. The camera stream has been stopped.",
  };
}
async function requestMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "Microphone access is not supported in this browser or context.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  return {
    state: "Granted",
    message:
      "Microphone access was granted. The audio stream has been stopped.",
  };
}
async function requestGeolocation() {
  if (!navigator.geolocation)
    throw new Error("Geolocation is not supported by this browser.");
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          state: "Granted",
          message: `Location received (accuracy ${Math.round(position.coords.accuracy)} m).`,
        }),
      (error) => reject(new Error(error.message)),
      { timeout: 15000, maximumAge: 0 },
    ),
  );
}
async function requestNotifications() {
  if (!("Notification" in window))
    throw new Error("Notifications are not supported by this browser.");
  const state = await Notification.requestPermission();
  if (state === "granted") {
    try {
      new Notification("Meridix Lab", {
        body: "Notification permission is working.",
      });
    } catch {}
    return { state, message: "Notification permission was granted." };
  }
  if (state === "denied")
    return { state: "denied", message: "Notification permission was denied." };
  return { state: "prompt", message: "The permission prompt was dismissed." };
}
async function requestClipboard() {
  if (!navigator.clipboard?.readText)
    throw new Error(
      "Clipboard reading is unavailable. Use a secure context such as HTTPS or localhost.",
    );
  await navigator.clipboard.readText();
  return { state: "Granted", message: "Clipboard read access was granted." };
}
async function requestMidi() {
  if (!navigator.requestMIDIAccess)
    throw new Error("Web MIDI is not supported by this browser.");
  await navigator.requestMIDIAccess({ sysex: false });
  return { state: "Granted", message: "MIDI access was granted." };
}
async function requestBluetooth() {
  if (!navigator.bluetooth?.requestDevice)
    throw new Error(
      "Web Bluetooth is not supported in this browser or context.",
    );
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
  });
  return {
    state: "Granted",
    message: `Device selected: ${device.name || "Unnamed device"}.`,
  };
}
async function requestUsb() {
  if (!navigator.usb?.requestDevice)
    throw new Error("WebUSB is not supported in this browser or context.");
  const device = await navigator.usb.requestDevice({ filters: [] });
  return {
    state: "Granted",
    message: `USB device selected (vendor ${device.vendorId}).`,
  };
}
async function requestSerial() {
  if (!navigator.serial?.requestPort)
    throw new Error("Web Serial is not supported in this browser or context.");
  await navigator.serial.requestPort();
  return { state: "Granted", message: "Serial port access was granted." };
}
async function requestHid() {
  if (!navigator.hid?.requestDevice)
    throw new Error("WebHID is not supported in this browser or context.");
  const devices = await navigator.hid.requestDevice({ filters: [] });
  if (!devices.length)
    return { state: "prompt", message: "No HID device was selected." };
  return {
    state: "Granted",
    message: `${devices.length} HID device${devices.length === 1 ? "" : "s"} selected.`,
  };
}
permissionDefinitions.forEach(renderPermission);
const vibrationSupported = typeof navigator.vibrate === "function";
document.getElementById("vibration-support").textContent = vibrationSupported
  ? "Supported by this browser"
  : "Unsupported by this browser";
document.getElementById("vibration-dot").style.background = vibrationSupported
  ? "var(--green)"
  : "var(--red)";
function vibrate(pattern) {
  if (!vibrationSupported) {
    showToast(
      "warning",
      "Vibration unsupported",
      "This browser does not provide the Vibration API.",
    );
    return;
  }
  const result = navigator.vibrate(pattern);
  if (result)
    showToast(
      "success",
      "Vibration executed",
      "The browser accepted the vibration request. Hardware support may vary.",
    );
  else
    showToast(
      "warning",
      "Vibration not started",
      "The browser reported that vibration could not be started.",
    );
}
document
  .querySelectorAll("[data-vibrate]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      vibrate(Number(button.dataset.vibrate)),
    ),
  );
document
  .getElementById("vibrate-pattern")
  .addEventListener("click", () => vibrate([200, 100, 200, 100, 500]));
document.getElementById("vibrate-stop").addEventListener("click", async () => {
  if (!vibrationSupported) {
    showToast(
      "warning",
      "Vibration unsupported",
      "This browser does not provide the Vibration API.",
    );
    return;
  }
  if (
    await confirmAction("Stop vibration", "Send a stop request to the device?")
  ) {
    const result = navigator.vibrate(0);
    showToast(
      result ? "success" : "warning",
      result ? "Vibration stopped" : "Stop request not accepted",
      result
        ? "A stop request was sent."
        : "The browser reported that the stop request failed.",
    );
  }
});
const form = document.getElementById("demo-form");
const customInput = document.getElementById("custom-input");
customInput.addEventListener("input", () =>
  customInput.setCustomValidity(
    customInput.value && customInput.value.toLowerCase() !== "meridix"
      ? "Enter “meridix” to pass custom validation."
      : "",
  ),
);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) {
    showToast(
      "error",
      "Validation error",
      "Check the highlighted fields and correct the values.",
    );
    document.getElementById("result-state").textContent = "Validation failed";
    return;
  }
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (key === "file") {
      data[key] = value.name || null;
    } else if (key === "multi-select") {
      data[key] = Array.from(form.elements[key].selectedOptions).map(
        (option) => option.value,
      );
    } else if (key in data) {
      data[key] = Array.isArray(data[key])
        ? [...data[key], value]
        : [data[key], value];
    } else {
      data[key] = value;
    }
  }
  document.getElementById("form-results").textContent = JSON.stringify(
    data,
    null,
    2,
  );
  document.getElementById("result-state").textContent = "Submitted";
  showToast(
    "success",
    "Form submitted",
    "The form was handled locally. No page navigation occurred.",
  );
});
form.addEventListener("reset", () => {
  setTimeout(() => {
    document.getElementById("form-results").textContent =
      "Submitted values will appear here.";
    document.getElementById("result-state").textContent =
      "Waiting for submission";
    customInput.setCustomValidity("");
    document.getElementById("range-value").textContent =
      document.getElementById("range").value;
  }, 0);
  showToast(
    "warning",
    "Form reset",
    "All form controls were returned to their initial values.",
  );
});
document
  .getElementById("range")
  .addEventListener(
    "input",
    (event) =>
      (document.getElementById("range-value").textContent = event.target.value),
  );
