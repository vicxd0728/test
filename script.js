const conversionsToPa = {
  Pa: 1,
  kPa: 1_000,
  MPa: 1_000_000,
  bar: 100_000,
  atm: 101_325,
  psi: 6_894.75729,
  mmHg: 133.322368,
};

const unitLabels = {
  Pa: "Pa",
  kPa: "kPa",
  MPa: "MPa",
  bar: "bar",
  atm: "atm",
  psi: "psi",
  mmHg: "mmHg",
};

const historyKey = "pressure-converter-history";
const maxHistory = 20;

const form = document.getElementById("converter-form");
const valueInput = document.getElementById("pressure-value");
const fromSelect = document.getElementById("from-unit");
const toSelect = document.getElementById("to-unit");
const resultDisplay = document.getElementById("result-display");
const errorMessage = document.getElementById("error-message");
const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history");
const interactiveFields = [valueInput, fromSelect, toSelect];

const history = loadHistory();
renderHistory();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const rawValue = valueInput.value.trim();
  if (!rawValue) {
    showError("請輸入要轉換的壓力值。", valueInput);
    valueInput.focus();
    return;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    showError("壓力值必須是數字。", valueInput);
    valueInput.focus();
    return;
  }

  const fromUnit = fromSelect.value;
  const toUnit = toSelect.value;

  if (!conversionsToPa[fromUnit] || !conversionsToPa[toUnit]) {
    showError("選擇的單位無法識別。", fromSelect, toSelect);
    fromSelect.focus();
    return;
  }

  if (fromUnit === toUnit) {
    showError("請選擇不同的單位進行轉換。", fromSelect, toSelect);
    toSelect.focus();
    return;
  }

  const baseValue = value * conversionsToPa[fromUnit];
  const convertedValue = baseValue / conversionsToPa[toUnit];

  const formatted = formatNumber(convertedValue);
  resultDisplay.textContent = `${formatNumber(value)} ${unitLabels[fromUnit]} = ${formatted} ${unitLabels[toUnit]}`;
  showError("");

  addHistoryEntry({
    value,
    fromUnit,
    toUnit,
    result: convertedValue,
    timestamp: new Date().toISOString(),
  });
});

clearHistoryButton.addEventListener("click", () => {
  history.length = 0;
  saveHistory();
  renderHistory();
});

function formatNumber(value) {
  const abs = Math.abs(value);
  let minimumFractionDigits = abs >= 1 ? 2 : 4;
  let maximumFractionDigits = 6;

  if (abs !== 0 && abs < 0.001) {
    maximumFractionDigits = 10;
    minimumFractionDigits = 0;
  }

  return new Intl.NumberFormat("zh-Hant", {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

function showError(message, ...fields) {
  errorMessage.textContent = message;

  interactiveFields.forEach((field) => {
    field.classList.remove("form-input--error");
    field.removeAttribute("aria-invalid");
  });

  if (!message || fields.length === 0) {
    return;
  }

  fields.forEach((field) => {
    field.classList.add("form-input--error");
    field.setAttribute("aria-invalid", "true");
  });
}

function addHistoryEntry(entry) {
  history.unshift(entry);
  if (history.length > maxHistory) {
    history.length = maxHistory;
  }
  saveHistory();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  clearHistoryButton.disabled = history.length === 0;

  if (history.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.textContent = "目前尚無詢問紀錄。";
    emptyState.className = "history-empty";
    historyList.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  history.forEach((entry) => {
    const item = document.createElement("li");
    const description = document.createElement("strong");
    description.textContent = `${formatNumber(entry.value)} ${unitLabels[entry.fromUnit]} → ${formatNumber(entry.result)} ${unitLabels[entry.toUnit]}`;

    const time = document.createElement("time");
    const date = new Date(entry.timestamp);
    time.dateTime = entry.timestamp;
    time.textContent = date.toLocaleString("zh-Hant", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    item.appendChild(description);
    item.appendChild(time);

    fragment.appendChild(item);
  });

  historyList.appendChild(fragment);
}

function loadHistory() {
  try {
    const stored = localStorage.getItem(historyKey);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(validateHistoryEntry);
  } catch (error) {
    console.warn("無法載入歷史紀錄", error);
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch (error) {
    console.warn("無法儲存歷史紀錄", error);
  }
}

function validateHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const { value, fromUnit, toUnit, result, timestamp } = entry;
  return (
    Number.isFinite(value) &&
    Number.isFinite(result) &&
    typeof fromUnit === "string" &&
    typeof toUnit === "string" &&
    Boolean(conversionsToPa[fromUnit]) &&
    Boolean(conversionsToPa[toUnit]) &&
    typeof timestamp === "string"
  );
}
