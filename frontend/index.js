"use strict";

/* =========================================================
   KONFIGURACJA
   ========================================================= */

const API = "http://localhost:8000/api";
const UNASSIGNED = "Brak działu";

// Kolejność kolumn w tabeli dla zwykłego użytkownika
const COLUMNS = [
    "Id",
    "Nr telefonu",
    "Nr pokoju",
    "Oznaczenie użytkownika",
    "Imię",
    "Nazwisko",
    "Adres pocztowy elektroniczny",
];

const STORAGE = {
    theme: "telebook-theme",
    collapsed: "telebook-collapsed-sections",
};

const $ = (id) => document.getElementById(id);

const container = $("dynamic-tables-container");
const globalSearch = $("global-search");
const clearSearch = $("clear-search");
const searchInfo = $("search-info");

const state = {
    users: [],
    sections: [],
    loaded: false,
};

/* =========================================================
   NARZĘDZIA
   ========================================================= */

const storage = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* tryb prywatny / brak miejsca – pomijamy */
        }
    },
};

// Zabezpieczenie przed XSS
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

// Normalizowanie tekstu do wyszukiwania (małe litery, bez ogonków)
function normalize(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/ł/g, "l")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function splitWords(text) {
    return text.split(/\s+/).filter(Boolean);
}

// API zwraca albo tablicę, albo { data: [...] }
function unwrap(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    return [];
}

function errorText(error) {
    return error instanceof TypeError
        ? "brak połączenia z serwerem"
        : error.message;
}

/* =========================================================
   KOMUNIKACJA Z API
   ========================================================= */

async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        credentials: 'include', // <--- KLUCZOWE: wysyła ciasteczko sesyjne do backendu
        headers: {
            Accept: "application/json",
            ...options.headers,
        },
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Status: ${response.status}`);
    }

    return response.status === 204 ? null : response.json().catch(() => null);
}

/* =========================================================
   MOTYW (jasny / ciemny)
   ========================================================= */

const root = document.documentElement;
const themeToggle = $("theme-toggle");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let themeSwitchTimer;

function readSavedTheme() {
    try {
        return localStorage.getItem(STORAGE.theme);
    } catch {
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(STORAGE.theme, theme);
    } catch {
        /* pomijamy */
    }
}

function applyTheme(dark, animate) {
    if (animate && !reduceMotion.matches) {
        root.classList.add("theme-switching");
        clearTimeout(themeSwitchTimer);
        themeSwitchTimer = setTimeout(
            () => root.classList.remove("theme-switching"),
            600
        );
    }
    root.classList.toggle("dark-mode", dark);
    if (themeToggle) themeToggle.checked = dark;
}

function initTheme() {
    const saved = readSavedTheme();
    applyTheme(saved ? saved === "dark" : darkQuery.matches, false);

    if (themeToggle) {
        themeToggle.addEventListener("change", () => {
            applyTheme(themeToggle.checked, true);
            saveTheme(themeToggle.checked ? "dark" : "light");
        });
    }

    darkQuery.addEventListener("change", (event) => {
        if (!readSavedTheme()) applyTheme(event.matches, true);
    });
}

/* =========================================================
   POBIERANIE DANYCH I RENDEROWANIE
   ========================================================= */

const collapsedSections = new Set(
    (() => {
        const saved = storage.get(STORAGE.collapsed, []);
        return Array.isArray(saved) ? saved : [];
    })()
);

let refreshToken = 0;

async function refreshData() {
    const token = ++refreshToken;

    try {
        const [users, sections] = await Promise.all([
            api("/userdata"),
            api("/sections"),
        ]);

        if (token !== refreshToken) return;

        state.users = unwrap(users);
        state.sections = unwrap(sections);
        state.loaded = true;

        renderGroups();
    } catch (error) {
        if (token !== refreshToken) return;
        console.error("Błąd podczas pobierania danych:", error);
        showLoadError(error);
    }
}

function showLoadError(error) {
    container.innerHTML = `
        <div class="state-message">
            <div>Nie udało się pobrać danych: ${escapeHtml(errorText(error))}</div>
            <button type="button" class="button button-primary" data-action="retry">Spróbuj ponownie</button>
        </div>
    `;
    if (searchInfo) searchInfo.textContent = "Brak danych";
}

function rowHTML(user) {
    const id = user.id ?? "";
    const phone = user.phone_number || "";
    const room = user.details?.room_number || "";
    const designation = user.designation || "";
    const name = user.name || "";
    const lastName = user.last_name || "";
    const email = user.email || "";

    const phoneCell = phone
        ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>`
        : "";
    const emailCell = email
        ? `<a href="mailto:${escapeHtml(encodeURI(email))}">${escapeHtml(email)}</a>`
        : "";

    return `
        <tr>
            <td>${escapeHtml(id)}</td>
            <td>${phoneCell}</td>
            <td>${escapeHtml(room)}</td>
            <td>${escapeHtml(designation)}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(lastName)}</td>
            <td>${emailCell}</td>
        </tr>
    `;
}

function groupHTML(name, { users }) {
    const safeName = escapeHtml(name);
    const isCollapsed = collapsedSections.has(name);

    const headCells = COLUMNS.map((column) => `<th>${column}</th>`).join("");
    const filterCells = COLUMNS.map(
        (column) => `
            <th><input type="text" class="filter-input" placeholder="Filtruj"
                       aria-label="Filtruj: ${column}" autocomplete="off"></th>`
    ).join("");

    return `
        <div class="table-group${isCollapsed ? " collapsed" : ""}" data-dept="${safeName}">
            <div class="table-header">
                <button type="button" class="collapse-button" data-action="toggle-section"
                        aria-expanded="${!isCollapsed}"
                        aria-label="Zwiń lub rozwiń dział ${safeName}"></button>

                <div class="table-title">
                    <h2 class="table-name">${safeName}</h2>
                    <span class="table-count" title="Liczba użytkowników">${users.length}</span>
                </div>
            </div>

            <div class="table-container">
                <table class="table-data">
                    <thead>
                        <tr>${headCells}</tr>
                        <tr class="filter-row">${filterCells}</tr>
                    </thead>
                    <tbody>
                        ${users.map(rowHTML).join("")}
                        <tr class="empty-row" hidden><td colspan="${COLUMNS.length}"></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function captureFilters() {
    const saved = new Map();
    container.querySelectorAll(".table-group").forEach((group) => {
        saved.set(
            group.dataset.dept,
            [...group.querySelectorAll(".filter-input")].map((input) => input.value)
        );
    });
    return saved;
}

function restoreFilters(saved) {
    container.querySelectorAll(".table-group").forEach((group) => {
        const values = saved.get(group.dataset.dept);
        if (!values) return;
        group.querySelectorAll(".filter-input").forEach((input, index) => {
            input.value = values[index] ?? "";
        });
    });
}

function renderGroups() {
    const savedFilters = captureFilters();
    const scrollY = window.scrollY;

    const groups = new Map();

    [...state.sections]
        .sort((a, b) => a.department.localeCompare(b.department, "pl"))
        .forEach((section) => {
            groups.set(section.department, { users: [] });
        });

    state.users.forEach((user) => {
        const department = user.section?.department || UNASSIGNED;
        if (!groups.has(department)) {
            groups.set(department, { users: [] });
        }
        groups.get(department).users.push(user);
    });

    if (groups.size === 0) {
        container.innerHTML = `<div class="state-message">Brak działów do wyświetlenia.</div>`;
        applyFilters();
        return;
    }

    container.innerHTML = [...groups]
        .map(([name, group]) => groupHTML(name, group))
        .join("");

    restoreFilters(savedFilters);
    applyFilters();
    window.scrollTo(0, scrollY);
}

/* =========================================================
   WYSZUKIWANIE I FILTRY
   ========================================================= */

function rowCells(row) {
    if (!row._cells) {
        row._cells = [...row.cells].map((cell) => normalize(cell.textContent));
    }
    return row._cells;
}

function rowMatches(cells, department, filters, words) {
    const rowText = `${cells.join(" ")} ${department}`;

    if (!words.every((word) => rowText.includes(word))) return false;

    return filters.every((filter, index) => {
        if (!filter) return true;

        const cell = cells[index];
        if (cell === undefined) return false;

        return index === 0
            ? cell === filter
            : splitWords(filter).every((word) => cell.includes(word));
    });
}

function filterGroup(group, words) {
    const table = group.querySelector(".table-data");
    const filters = [...table.querySelectorAll(".filter-input")].map((input) =>
        normalize(input.value)
    );
    const hasColumnFilters = filters.some(Boolean);
    const department = normalize(group.dataset.dept);
    const rows = [...table.querySelectorAll("tbody tr:not(.empty-row)")];

    let visible = 0;

    rows.forEach((row) => {
        const match = rowMatches(rowCells(row), department, filters, words);
        row.hidden = !match;
        row.classList.toggle("search-match", match && words.length > 0);
        if (match) visible++;
    });

    const emptyRow = table.querySelector(".empty-row");
    emptyRow.hidden = visible !== 0;
    emptyRow.firstElementChild.textContent =
        rows.length === 0
            ? "Ten dział nie ma jeszcze użytkowników"
            : "Brak wyników dla wybranych filtrów";

    group.classList.toggle(
        "no-results",
        rows.length > 0 && visible === 0 && (hasColumnFilters || words.length > 0)
    );

    const forceOpen = hasColumnFilters || words.length > 0;
    group.classList.toggle("force-open", forceOpen);

    const toggle = group.querySelector(".collapse-button");
    if (toggle) {
        const isOpen = !group.classList.contains("collapsed") || forceOpen;
        toggle.setAttribute("aria-expanded", String(isOpen));
    }

    group.hidden = words.length > 0 && visible === 0 && !hasColumnFilters;

    return visible;
}

function updateInfo(words, total, groupsCount) {
    if (!searchInfo) return;

    if (state.users.length === 0) {
        searchInfo.textContent = "Brak użytkowników";
    } else if (total === 0) {
        searchInfo.textContent = "Nie znaleziono użytkowników";
    } else if (words.length === 0) {
        searchInfo.textContent = `Widocznych użytkowników: ${total}`;
    } else {
        const userWord = total === 1 ? "użytkownika" : "użytkowników";
        const groupWord = groupsCount === 1 ? "dziale" : "działach";
        searchInfo.textContent = `Znaleziono ${total} ${userWord} w ${groupsCount} ${groupWord}`;
    }
}

function applyFilters() {
    if (!globalSearch) return;
    const words = splitWords(normalize(globalSearch.value));
    let totalVisible = 0;
    let visibleGroups = 0;

    container.querySelectorAll(".table-group").forEach((group) => {
        const count = filterGroup(group, words);
        if (count > 0) {
            totalVisible += count;
            visibleGroups++;
        }
    });

    updateInfo(words, totalVisible, visibleGroups);
}

function clearAllFilters() {
    if (globalSearch) globalSearch.value = "";
    container.querySelectorAll(".filter-input").forEach((input) => {
        input.value = "";
    });
    applyFilters();
    if (globalSearch) globalSearch.focus();
}

function initSearch() {
    if (globalSearch) globalSearch.addEventListener("input", applyFilters);
    if (clearSearch) clearSearch.addEventListener("click", clearAllFilters);

    container.addEventListener("input", (event) => {
        if (event.target.matches(".filter-input")) applyFilters();
    });
}

/* =========================================================
   OBSŁUGA ZWIJANIA SEKCJI
   ========================================================= */

function toggleSection(button) {
    const group = button.closest(".table-group");
    const name = group.dataset.dept;

    const nowCollapsed = group.classList.toggle("collapsed");
    if (nowCollapsed) {
        collapsedSections.add(name);
    } else {
        collapsedSections.delete(name);
    }
    storage.set(STORAGE.collapsed, [...collapsedSections]);

    const isOpen = !nowCollapsed || group.classList.contains("force-open");
    button.setAttribute("aria-expanded", String(isOpen));
}

function initTableActions() {
    container.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        switch (button.dataset.action) {
            case "toggle-section":
                toggleSection(button);
                break;
            case "retry":
                container.innerHTML = `<div class="state-message">Ładowanie danych…</div>`;
                await refreshData();
                break;
        }
    });
}

/* =========================================================
   START
   ========================================================= */

initTheme();
initSearch();
initTableActions();
refreshData();