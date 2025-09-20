const PRESSURE_UNITS = [
  { id: 'Pa', name: '帕', symbol: 'Pa', factor: 1 },
  { id: 'kPa', name: '千帕', symbol: 'kPa', factor: 1_000 },
  { id: 'MPa', name: '兆帕', symbol: 'MPa', factor: 1_000_000 },
  { id: 'bar', name: '巴', symbol: 'bar', factor: 100_000 },
  { id: 'atm', name: '標準大氣壓', symbol: 'atm', factor: 101_325 },
  { id: 'psi', name: '磅/平方英吋', symbol: 'psi', factor: 6_894.757293168 },
  { id: 'torr', name: '托', symbol: 'Torr', factor: 133.3223684211 },
  { id: 'mmHg', name: '毫米汞柱', symbol: 'mmHg', factor: 133.322387415 }
];

const unitsById = new Map(PRESSURE_UNITS.map((unit) => [unit.id, unit]));
const numberFormatter = new Intl.NumberFormat('zh-Hant', {
  maximumFractionDigits: 6
});
const dateTimeFormatter = new Intl.DateTimeFormat('zh-Hant', {
  dateStyle: 'short',
  timeStyle: 'medium'
});

const HISTORY_STORAGE_KEY = 'pressure-converter-history-v1';
const MAX_HISTORY_ENTRIES = 20;

const form = document.getElementById('converter-form');
const valueInput = document.getElementById('pressure-value');
const fromSelect = document.getElementById('from-unit');
const toSelect = document.getElementById('to-unit');
const resultOutput = document.getElementById('result');
const errorMessage = document.getElementById('error-message');
const resetButton = document.getElementById('reset-button');
const historyBody = document.getElementById('history-body');
const historyEmpty = document.getElementById('history-empty');
const historyWrapper = document.querySelector('.history-table-wrapper');
const clearHistoryButton = document.getElementById('clear-history');

const canUseLocalStorage = (() => {
  try {
    const testKey = '__pressure_converter__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
})();

populateUnitOptions(fromSelect);
populateUnitOptions(toSelect);
setDefaultUnitSelection('kPa', 'psi');

let historyEntries = loadHistory();
renderHistory();
updateClearHistoryButtonState();

form.addEventListener('submit', handleConvertSubmit);
resetButton.addEventListener('click', handleReset);
clearHistoryButton.addEventListener('click', handleClearHistory);

function populateUnitOptions(selectElement) {
  PRESSURE_UNITS.forEach((unit) => {
    const option = document.createElement('option');
    option.value = unit.id;
    option.textContent = `${unit.name} (${unit.symbol})`;
    selectElement.append(option);
  });
}

function setDefaultUnitSelection(fromId, toId) {
  if (fromSelect.querySelector(`option[value="${fromId}"]`)) {
    fromSelect.value = fromId;
  }
  if (toSelect.querySelector(`option[value="${toId}"]`)) {
    toSelect.value = toId;
  }

  if (fromSelect.value === toSelect.value) {
    const alternative = PRESSURE_UNITS.find((unit) => unit.id !== fromSelect.value);
    if (alternative) {
      toSelect.value = alternative.id;
    }
  }
}

function handleConvertSubmit(event) {
  event.preventDefault();

  const rawValue = valueInput.value.trim();
  const numericValue = Number(rawValue);
  const fromUnit = unitsById.get(fromSelect.value);
  const toUnit = unitsById.get(toSelect.value);

  if (!rawValue) {
    showError('請輸入欲換算的壓力數值。');
    return;
  }

  if (!Number.isFinite(numericValue)) {
    showError('請輸入有效的數字。');
    return;
  }

  if (!fromUnit || !toUnit) {
    showError('請選擇欲轉換的單位。');
    return;
  }

  hideError();

  const convertedValue = convertPressure(numericValue, fromUnit, toUnit);
  const formattedInput = formatValue(numericValue);
  const formattedOutput = formatValue(convertedValue);

  resultOutput.textContent = `${formattedInput} ${fromUnit.symbol} = ${formattedOutput} ${toUnit.symbol}`;

  addToHistory({
    timestamp: new Date().toISOString(),
    value: numericValue,
    from: fromUnit.id,
    to: toUnit.id,
    result: convertedValue
  });
}

function handleReset() {
  hideError();
  resultOutput.textContent = '請輸入數值以開始轉換。';
}

function handleClearHistory() {
  if (!historyEntries.length) {
    return;
  }

  const confirmed = window.confirm('確定要刪除所有詢問紀錄嗎？此動作無法復原。');
  if (!confirmed) {
    return;
  }

  historyEntries = [];
  saveHistory();
  renderHistory();
  updateClearHistoryButtonState();
}

function showError(message) {
  errorMessage.textContent = message;
  resultOutput.textContent = '—';
}

function hideError() {
  errorMessage.textContent = '';
}

function convertPressure(value, fromUnit, toUnit) {
  const valueInPascal = value * fromUnit.factor;
  return valueInPascal / toUnit.factor;
}

function formatValue(value) {
  if (!Number.isFinite(value)) {
    return '無法計算';
  }

  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  const abs = Math.abs(normalized);

  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) {
    return normalized.toExponential(6).replace(/\.0+e/, 'e');
  }

  return numberFormatter.format(normalized);
}

function addToHistory(entry) {
  historyEntries = [entry, ...historyEntries].slice(0, MAX_HISTORY_ENTRIES);
  saveHistory();
  renderHistory();
  updateClearHistoryButtonState();
}

function renderHistory() {
  historyBody.innerHTML = '';

  if (!historyEntries.length) {
    historyEmpty.classList.remove('hidden');
    historyWrapper.classList.remove('visible');
    return;
  }

  historyEmpty.classList.add('hidden');
  historyWrapper.classList.add('visible');

  historyEntries.forEach((entry) => {
    const row = document.createElement('tr');
    const fromUnit = unitsById.get(entry.from);
    const toUnit = unitsById.get(entry.to);
    const timestamp = formatTimestamp(entry.timestamp);

    row.innerHTML = `
      <td>${timestamp}</td>
      <td>${formatValue(entry.value)} ${fromUnit ? fromUnit.symbol : entry.from}</td>
      <td>${fromUnit ? fromUnit.name : entry.from} → ${toUnit ? toUnit.name : entry.to}</td>
      <td>${formatValue(entry.result)} ${toUnit ? toUnit.symbol : entry.to}</td>
    `;

    historyBody.append(row);
  });
}

function formatTimestamp(timestamp) {
  try {
    return dateTimeFormatter.format(new Date(timestamp));
  } catch (error) {
    return timestamp;
  }
}

function loadHistory() {
  if (!canUseLocalStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => sanitizeHistoryEntry(entry))
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch (error) {
    return [];
  }
}

function saveHistory() {
  if (!canUseLocalStorage) {
    return;
  }

  try {
    if (!historyEntries.length) {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries));
  } catch (error) {
    // Ignore write errors silently.
  }
}

function sanitizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const { timestamp, value, from, to, result } = entry;

  if (typeof timestamp !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    return null;
  }

  const numericValue = Number(value);
  const numericResult = Number(result);

  if (!Number.isFinite(numericValue) || !Number.isFinite(numericResult)) {
    return null;
  }

  if (!unitsById.has(from) || !unitsById.has(to)) {
    return null;
  }

  return {
    timestamp,
    value: numericValue,
    from,
    to,
    result: numericResult
  };
}

function updateClearHistoryButtonState() {
  clearHistoryButton.disabled = historyEntries.length === 0;
}
