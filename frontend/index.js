"use strict";

/* =========================================================
   KONFIGURACJA
   ========================================================= */

const API = "http://10.10.1.5:8000/api";
const UNASSIGNED = "Brak działu";

const STORAGE = {
    theme: "telebook-theme",
};

/* =========================================================
   NARZĘDZIA
   ========================================================= */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

function boldLastDigits(text) {
    const digits = text.replace(/\D/g, "");
    if (!/^(0048|48)?4291/.test(digits)) return escapeHtml(text);

    const match = text.match(/^(.*?)(\d[\s-]?\d[\s-]?\d)$/);
    if (!match) return escapeHtml(text);

    return `${escapeHtml(match[1])}<b>${escapeHtml(match[2])}</b>`;
}

const telLink = (v) =>
    v
        ? `<a href="tel:${escapeHtml(v.replace(/[^\d+]/g, ""))}">${boldLastDigits(v)}</a>`
        : "";

const mailLink = (v) =>
    v
        ? v
            .split(/[\s,;]+/)
            .filter(Boolean)
            .map(e => `<a href="mailto:${escapeHtml(encodeURI(e))}">${escapeHtml(e)}</a>`)
            .join("<br>")
        : "";

const COLUMNS = [
    { key: "phone",       label: "Tel",                          value: (u) => u.phone_number, render: telLink },
    { key: "room",        label: "Pokój",                        value: (u) => u.details?.room_number },
    { key: "designation", label: "Oznaczenie użytkownika",       value: (u) => u.designation },
    { key: "name",        label: "Imię",                         value: (u) => u.name },
    { key: "last_name",   label: "Nazwisko",                     value: (u) => u.last_name },
    { key: "email",       label: "Adres pocztowy elektroniczny", value: (u) => u.email, render: mailLink },
];

/* =========================================================
   ELEMENTY STRONY I STAN
   ========================================================= */

const container = $("dynamic-tables-container");
const globalSearch = $("global-search");
const clearSearch = $("clear-search");
const searchInfo = $("search-info");

const state = {
    users: [],
    sections: [],
    subsections: [],
    sectionOrder: [],
    loaded: false,
};

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

const userSubId = (user) => user.subsection_id ?? user.subsection?.id ?? null;

/* =========================================================
   KOMUNIKACJA Z API
   ========================================================= */

async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        credentials: "include",
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
    } catch {}
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
   POBIERANIE DANYCH I RENDEROWANIE Z PODSEKCJAMI
   ========================================================= */

let refreshToken = 0;

async function refreshData() {
    const token = ++refreshToken;

    try {
        const [users, sections, subsections, order] = await Promise.all([
            api("/userdata"),
            api("/sections"),
            api("/subsections").catch(() => []),
            api("/section-order").catch(() => []),
        ]);

        if (token !== refreshToken) return;

        state.users = unwrap(users);
        state.sections = unwrap(sections);
        state.subsections = unwrap(subsections);
        state.sectionOrder = Array.isArray(order) ? order : unwrap(order);
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
    const cells = COLUMNS.map((col) => {
        const raw = col.value(user);
        const text = raw === null || raw === undefined ? "" : String(raw);
        const html = col.render ? col.render(text) : escapeHtml(text);
        return `<td class="col-${col.key}" data-label="${escapeHtml(col.label)}">${html}</td>`;
    }).join("");

    return `<tr>${cells}</tr>`;
}

function renderTableContainer(users, headCells) {
    return `
        <div class="table-container">
            <table class="table-data">
                <thead>
                    <tr>${headCells}</tr>
                </thead>
                <tbody>
                    ${users.map(rowHTML).join("")}
                    <tr class="empty-row" hidden><td colspan="${COLUMNS.length}"></td></tr>
                </tbody>
            </table>
        </div>
    `;
}

function departmentHTML(deptName, deptData) {
    const safeDeptName = escapeHtml(deptName);
    const headCells = COLUMNS.map(
        (col) => `<th class="col-${col.key}">${escapeHtml(col.label)}</th>`
    ).join("");

    let html = `
        <div class="table-group" data-dept="${safeDeptName}">
            <div class="table-header">
                <div class="table-title">
                    <h2 class="table-name">${safeDeptName}</h2>
                </div>
            </div>
    `;

    const knownSubIds = new Set(deptData.subsections.map((s) => String(s.id)));
    const isInSub = (u) => userSubId(u) !== null && knownSubIds.has(String(userSubId(u)));

    // Użytkownicy bezpośrednio w dziale (bez podsekcji)
    const directUsers = deptData.users.filter((u) => !isInSub(u));
    if (directUsers.length > 0) {
        html += renderTableContainer(directUsers, headCells);
    }

    // Podsekcje i ich użytkownicy
    deptData.subsections.forEach((sub) => {
        const subUsers = deptData.users.filter((u) => String(userSubId(u)) === String(sub.id));
        const safeSubName = escapeHtml(sub.name);
        
        html += `
            <div class="subsection-wrapper">
                <h3 class="subsection-name">${safeSubName}</h3>
                ${renderTableContainer(subUsers, headCells)}
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

function renderGroups() {
    const scrollY = window.scrollY;
    const groups = new Map();

    // 1. Działy w kolejności ustawionej w section-order
    getOrderedSections().forEach((section) => {
        const dept = section.department || UNASSIGNED;
        if (!groups.has(dept)) {
            groups.set(dept, {
                id: section.id,
                subsections: state.subsections
                    .filter((sub) => String(sub.section_id) === String(section.id))
                    .sort((a, b) => a.name.localeCompare(b.name, "pl")),
                users: [],
            });
        }
    });

    // 2. Użytkownicy trafiają do swojego działu
    state.users.forEach((user) => {
        const department = user.section?.department || UNASSIGNED;
        if (!groups.has(department)) {
            groups.set(department, { id: undefined, subsections: [], users: [] });
        }
        groups.get(department).users.push(user);
    });

    if (groups.size === 0) {
        container.innerHTML = `<div class="state-message">Brak działów do wyświetlenia.</div>`;
        applyFilters();
        return;
    }

    container.innerHTML = [...groups]
        .map(([name, group]) => departmentHTML(name, group))
        .join("");

    applyFilters();
    window.scrollTo(0, scrollY);
}

/* =========================================================
   WYSZUKIWANIE
   ========================================================= */

function rowCells(row) {
    if (!row._cells) {
        row._cells = [...row.cells].map((cell) => normalize(cell.textContent));
    }
    return row._cells;
}

function filterGroup(group, words) {
    const tables = group.querySelectorAll(".table-data");
    const department = normalize(group.dataset.dept);
    
    let totalVisibleInGroup = 0;

    tables.forEach((table) => {
        const rows = [...table.querySelectorAll("tbody tr:not(.empty-row)")];
        let visibleInTable = 0;

        rows.forEach((row) => {
            const rowText = `${rowCells(row).join(" ")} ${department}`;
            const match = words.every((word) => rowText.includes(word));
            row.hidden = !match;
            row.classList.toggle("search-match", match && words.length > 0);
            if (match) visibleInTable++;
        });

        const emptyRow = table.querySelector(".empty-row");
        if (emptyRow) {
            emptyRow.hidden = visibleInTable !== 0;
            emptyRow.firstElementChild.textContent =
                rows.length === 0
                    ? "Brak użytkowników w tej sekcji"
                    : "Brak wyników dla wyszukiwanej frazy";
        }

        totalVisibleInGroup += visibleInTable;
    });

    group.classList.toggle("no-results", totalVisibleInGroup === 0 && words.length > 0);
    group.hidden = words.length > 0 && totalVisibleInGroup === 0;

    return totalVisibleInGroup;
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
    if (globalSearch) {
        globalSearch.value = "";
        globalSearch.focus();
    }
    applyFilters();
}

function initSearch() {
    if (globalSearch) globalSearch.addEventListener("input", applyFilters);
    if (clearSearch) clearSearch.addEventListener("click", clearAllFilters);
}

/* =========================================================
   AKCJE W TABELACH
   ========================================================= */

function getOrderedSections() {
    const rank = new Map(state.sectionOrder.map((id, index) => [String(id), index]));

    return [...state.sections].sort((a, b) => {
        const ra = rank.has(String(a.id)) ? rank.get(String(a.id)) : Infinity;
        const rb = rank.has(String(b.id)) ? rank.get(String(b.id)) : Infinity;

        if (ra === rb) return a.department.localeCompare(b.department, "pl");
        return ra < rb ? -1 : 1;
    });
}

function initTableActions() {
    container.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        switch (button.dataset.action) {
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