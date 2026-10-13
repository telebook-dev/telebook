"use strict";

/* =========================================================
   KONFIGURACJA
   (skrypt jest ładowany na końcu <body>, więc elementy już istnieją)
   ========================================================= */

const API = "http://localhost:8000/api";
const UNASSIGNED = "Brak działu";

// kolejność kolumn w tabeli (bez kolumny "Akcje")
const COLUMNS = [
    "Id",
    "Telefon",
    "Pokój",
    "Oznaczenie użytkownika",
    "Imię",
    "Nazwisko",
    "Adres pocztowy elektroniczny",
    "Ip",
];

// szerokości kolumn w % (razem z "Akcje" = 100)
const COLUMN_WIDTHS = [4, 6, 4, 12, 10, 14, 23, 7];
const ACTIONS_WIDTH = 9;

const STORAGE = {
    theme: "telebook-theme",
    panels: "telebook-panels-visible",
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

// zabezpieczenie przed XSS: wszystko, co trafia do innerHTML, przechodzi przez tę funkcję
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

// małe litery, bez ogonków (także „ł”), bez zbędnych spacji
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

function fullName(user) {
    return `${user.name ?? ""} ${user.last_name ?? ""}`.trim();
}

function errorText(error) {
    return error instanceof TypeError
        ? "brak połączenia z serwerem"
        : error.message;
}

/* =========================================================
   KOMUNIKACJA Z API
   ========================================================= */

async function readError(response) {
    const data = await response.json().catch(() => ({}));
    const details = data.errors
        ? Object.values(data.errors).flat().join("\n")
        : data.message;
    return details || `Status: ${response.status}`;
}

async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        },
    });

    if (response.status === 401) {
        window.location.replace("admin-login.html");
        throw new Error("Sesja wygasła");
    }

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.status === 204 ? null : response.json().catch(() => null);
}

/* =========================================================
   POWIADOMIENIA (zamiast alert)
   ========================================================= */

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    $("toast-container").appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    const dismiss = () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    };

    toast.addEventListener("click", dismiss);
    setTimeout(dismiss, type === "error" ? 7000 : 3500);
}

/* =========================================================
   OKNO POTWIERDZENIA (zamiast confirm)
   ========================================================= */

const confirmDialog = (() => {
    const dialog = $("confirm-dialog");
    const okButton = $("confirm-ok");

    // kliknięcie w tło zamyka okno (padding jest na <form>, więc target === dialog to tylko tło)
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close("cancel");
    });

    return ({ title, message, confirmLabel = "Usuń", variant = "danger" }) =>
        new Promise((resolve) => {
            $("confirm-title").textContent = title;
            $("confirm-message").textContent = message;
            okButton.textContent = confirmLabel;
            okButton.className = `button button-${variant}`;
            dialog.returnValue = "";

            dialog.addEventListener(
                "close",
                () => resolve(dialog.returnValue === "confirm"),
                { once: true }
            );

            dialog.showModal();
        });
})();

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
        // klasa włącza płynne przejście kolorów tylko na czas przełączenia
        root.classList.add("theme-switching");
        clearTimeout(themeSwitchTimer);
        themeSwitchTimer = setTimeout(
            () => root.classList.remove("theme-switching"),
            600
        );
    }
    root.classList.toggle("dark-mode", dark);
    themeToggle.checked = dark;
}

function initTheme() {
    const saved = readSavedTheme();
    applyTheme(saved ? saved === "dark" : darkQuery.matches, false);

    themeToggle.addEventListener("change", () => {
        applyTheme(themeToggle.checked, true);
        saveTheme(themeToggle.checked ? "dark" : "light");
    });

    // dopóki użytkownik sam nie wybrał motywu, podążamy za ustawieniem systemu
    darkQuery.addEventListener("change", (event) => {
        if (!readSavedTheme()) applyTheme(event.matches, true);
    });
}

/* =========================================================
   PANELE „DODAJ DZIAŁ” / „DODAJ UŻYTKOWNIKA” (pokaż / ukryj)
   ========================================================= */

function initPanelToggles() {
    const saved = storage.get(STORAGE.panels, {});
    const panelState = saved && typeof saved === "object" ? saved : {};

    document.querySelectorAll("[data-panel-toggle]").forEach((input) => {
        const panel = $(input.dataset.panelToggle);
        if (!panel) return;

        if (panelState[panel.id] === false) input.checked = false;
        panel.hidden = !input.checked;

        input.addEventListener("change", () => {
            panel.hidden = !input.checked;
            panelState[panel.id] = input.checked;
            storage.set(STORAGE.panels, panelState);
        });
    });
}

/* =========================================================
   LISTA DZIAŁÓW W FORMULARZU
   ========================================================= */

function populateSectionSelect(selectId = null) {
    const select = $("add-section-id");
    const previous = selectId ?? select.value;

    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Wybierz dział...";
    select.appendChild(placeholder);

    [...state.sections]
        .sort((a, b) => a.department.localeCompare(b.department, "pl"))
        .forEach((section) => {
            const option = document.createElement("option");
            option.value = section.id;
            option.textContent = section.department;
            select.appendChild(option);
        });

    if (previous) select.value = previous;
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

// jedno odświeżenie = jeden komplet zapytań (użytkownicy + działy równolegle)
async function refreshData({ selectSectionId = null } = {}) {
    const token = ++refreshToken;

    try {
        const [users, sections] = await Promise.all([
            api("/userdata"),
            api("/sections"),
        ]);

        // jeśli w międzyczasie ruszyło nowsze odświeżenie, ten wynik jest już nieaktualny
        if (token !== refreshToken) return;

        state.users = unwrap(users);
        state.sections = unwrap(sections);
        state.loaded = true;

        populateSectionSelect(selectSectionId);
        renderGroups();
    } catch (error) {
        if (token !== refreshToken) return;
        console.error("Błąd podczas pobierania danych:", error);

        if (state.loaded) {
            showToast(`Nie udało się odświeżyć danych: ${errorText(error)}`, "error");
        } else {
            showLoadError(error);
        }
    }
}

function showLoadError(error) {
    container.innerHTML = `
        <div class="state-message">
            <div>Nie udało się pobrać danych: ${escapeHtml(errorText(error))}</div>
            <button type="button" class="button button-primary" data-action="retry">Spróbuj ponownie</button>
        </div>
    `;
    searchInfo.textContent = "Brak danych";
}

function rowHTML(user) {
    const id = user.id ?? "";
    const phone = user.phone_number || "";
    const room = user.details?.room_number || "";
    const designation = user.designation || "";
    const name = user.name || "";
    const lastName = user.last_name || "";
    const email = user.email || "";
    const ip = user.details?.ip_number || "";

    const phoneCell = phone
        ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>`
        : "";
    const emailCell = email
        ? `<a href="mailto:${escapeHtml(encodeURI(email))}">${escapeHtml(email)}</a>`
        : "";

    // Tutaj zamieniamy zwykły tekst IP na link do noVNC
    // Zakładamy, że noVNC działa na porcie 6080 pod adresem hosta, na którym stoi Twój panel (window.location.hostname)
    let ipCell = "";
    if (ip) {
        // window.location.hostname wykryje czy jesteś na localhost, czy na serwerze produkcyjnym
        const novncUrl = `http://${window.location.hostname}:6080/vnc.html?path=${encodeURIComponent("websockify?token=" + ip)}&autoconnect=1&resize=scale`;
        ipCell = `<a href="${novncUrl}" target="_blank" title="Otwórz pulpit VNC">${escapeHtml(ip)}</a>`;
    }

    return `
        <tr>
            <td>${escapeHtml(id)}</td>
            <td>${phoneCell}</td>
            <td>${escapeHtml(room)}</td>
            <td>${escapeHtml(designation)}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(lastName)}</td>
            <td>${emailCell}</td>
            <td>${ipCell}</td>
            <td class="actions">
                <button type="button" class="edit-button"
        data-action="edit-user"
        data-id="${escapeHtml(id)}">Edit</button>
                <button type="button" class="delete-button"
                        data-action="delete-user"
                        data-id="${escapeHtml(id)}"
                        data-name="${escapeHtml(fullName(user))}">Delete</button>
            </td>
        </tr>
    `;
}

function groupHTML(name, { id, users }) {
    const safeName = escapeHtml(name);
    const canDelete = users.length === 0 && id !== undefined;

    const colgroup =
        COLUMN_WIDTHS.map((w) => `<col style="width:${w}%">`).join("") +
        `<col style="width:${ACTIONS_WIDTH}%">`;
    const headCells = COLUMNS.map((column) => `<th>${column}</th>`).join("");
    const filterCells = COLUMNS.map(
        (column) => `
            <th><input type="text" class="filter-input" placeholder="Filtruj"
                       aria-label="Filtruj: ${column}" autocomplete="off"></th>`
    ).join("");

    return `
        <div class="table-group" data-dept="${safeName}">
            <div class="table-header">
                <div class="table-title">
                    <h2 class="table-name">${safeName}</h2>
                </div>
                ${canDelete ? `
                    <button type="button" class="delete-section-button" data-action="delete-section"
                            data-section-id="${escapeHtml(id)}"
                            data-section-name="${safeName}">Usuń dział</button>` : ""}
            </div>

            <div class="table-container">
                <table class="table-data">
                    <colgroup>${colgroup}</colgroup>
                    <thead>
                        <tr>${headCells}<th>Akcje</th></tr>
                        <tr class="filter-row">${filterCells}<th></th></tr>
                    </thead>
                    <tbody>
                        ${users.map(rowHTML).join("")}
                        <tr class="empty-row" hidden><td colspan="${COLUMNS.length + 1}"></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// zapamiętujemy wartości filtrów kolumn, żeby przebudowa tabel ich nie czyściła
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
            groups.set(section.department, { id: section.id, users: [] });
        });

    state.users.forEach((user) => {
        const department = user.section?.department || UNASSIGNED;
        if (!groups.has(department)) {
            groups.set(department, { id: undefined, users: [] });
        }
        groups.get(department).users.push(user);
    });

    if (groups.size === 0) {
        container.innerHTML = `<div class="state-message">Nie ma jeszcze żadnych działów. Dodaj pierwszy, aby zacząć.</div>`;
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
   (nasłuchiwanie ustawiane RAZ; grupy są wyszukiwane przy każdym filtrowaniu)
   ========================================================= */

// znormalizowany tekst komórek wiersza liczymy raz i zapamiętujemy na elemencie
function rowCells(row) {
    if (!row._cells) {
        row._cells = [...row.cells]
            .filter((cell) => !cell.classList.contains("actions"))
            .map((cell) => normalize(cell.textContent));
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

        // kolumna Id: dokładne dopasowanie; pozostałe: wszystkie wpisane słowa
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

    group.hidden = words.length > 0 && visible === 0 && !hasColumnFilters;

    return visible;
}

function updateInfo(words, total, groupsCount) {
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
    globalSearch.value = "";
    container.querySelectorAll(".filter-input").forEach((input) => {
        input.value = "";
    });
    applyFilters();
    globalSearch.focus();
}

function initSearch() {
    globalSearch.addEventListener("input", applyFilters);
    clearSearch.addEventListener("click", clearAllFilters);

    // filtry kolumn: jeden nasłuch na kontenerze (działa też po przebudowie tabel)
    container.addEventListener("input", (event) => {
        if (event.target.matches(".filter-input")) applyFilters();
    });
}

/* =========================================================
   AKCJE W TABELACH (jeden nasłuch kliknięć na kontenerze)
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

async function deleteUser(button) {
    const { id, name } = button.dataset;
    if (!id) return;

    const confirmed = await confirmDialog({
        title: "Usunąć użytkownika?",
        message: `${name || "Ten użytkownik"} (ID: ${id}) zostanie trwale usunięty.`,
        confirmLabel: "Usuń",
    });
    if (!confirmed) return;

    button.disabled = true;

    try {
        await api(`/userdata/${encodeURIComponent(id)}`, { method: "DELETE" });
        await refreshData();
        showToast("Użytkownik został usunięty.");
    } catch (error) {
        console.error("Nie udało się usunąć użytkownika:", error);
        button.disabled = false;
        showToast(`Nie udało się usunąć użytkownika: ${errorText(error)}`, "error");
    }
}

async function deleteSection(button) {
    const { sectionId, sectionName } = button.dataset;
    if (!sectionId) return;

    const confirmed = await confirmDialog({
        title: "Usunąć dział?",
        message: `Dział „${sectionName}” zostanie trwale usunięty.`,
        confirmLabel: "Usuń dział",
    });
    if (!confirmed) return;

    button.disabled = true;

    try {
        await api(`/sections/${encodeURIComponent(sectionId)}`, { method: "DELETE" });
        await refreshData();
        showToast(`Usunięto dział „${sectionName}”.`);
    } catch (error) {
        console.error("Błąd usuwania działu:", error);
        button.disabled = false;
        showToast(`Nie udało się usunąć działu: ${errorText(error)}`, "error");
    }
}

function initTableActions() {
    container.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        switch (button.dataset.action) {
            case "toggle-section":
                toggleSection(button);
                break;
            case "edit-user":
                openEditDialog(button.dataset.id);
                break;    
            case "delete-user":
                await deleteUser(button);
                break;
            case "delete-section":
                await deleteSection(button);
                break;
            case "retry":
                container.innerHTML = `<div class="state-message">Ładowanie danych…</div>`;
                await refreshData();
                break;
        }
    });
}

/* =========================================================
   FORMULARZE
   ========================================================= */

function findDuplicates(newUser, ignoreId = null) {
    const others = state.users.filter((u) => String(u.id) !== String(ignoreId));
    const messages = [];

    const email = newUser.email.toLowerCase();
    const sameEmail = others.find((user) => (user.email || "").toLowerCase() === email);
    if (sameEmail) {
        messages.push(`Adres ${newUser.email} jest już przypisany do: ${fullName(sameEmail)}.`);
    }

    if (newUser.ip_number) {
        const sameIp = others.find((user) => (user.details?.ip_number || "") === newUser.ip_number);
        if (sameIp) {
            messages.push(`Adres IP ${newUser.ip_number} jest już przypisany do: ${fullName(sameIp)}.`);
        }
    }

    if (newUser.phone_number) {
        const samePhone = others.find((user) => (user.phone_number || "") === newUser.phone_number);
        if (samePhone) {
            messages.push(`Numer telefonu ${newUser.phone_number} jest już przypisany do: ${fullName(samePhone)}.`);
        }
    }

    return messages;
}

function initUserForm() {
    const form = $("add-user-form");
    const phoneInput = $("add-phone");

    // telefon: tylko cyfry, spacje, + i -
    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^\d+\- ]/g, "");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitButton = form.querySelector(".add-user-button");
        const value = (id) => $(id).value.trim();

        const newUser = {
            section_id: parseInt($("add-section-id").value, 10),
            designation: value("add-designation"),
            name: value("add-name"),
            last_name: value("add-last-name"),
            email: value("add-email"),
            phone_number: value("add-phone"),
            room_number: value("add-room"),
            ip_number: value("add-ip"),
        };

        const duplicates = findDuplicates(newUser);
        if (duplicates.length > 0) {
            const proceed = await confirmDialog({
                title: "Możliwy duplikat",
                message: duplicates.join("\n"),
                confirmLabel: "Dodaj mimo to",
                variant: "primary",
            });
            if (!proceed) return;
        }

        submitButton.disabled = true;

        try {
            await api("/userdata", {
                method: "POST",
                body: JSON.stringify(newUser),
            });

            // szybkie dodawanie kolejnych osób: dział zostaje wybrany, kursor wraca na początek
            const sectionValue = $("add-section-id").value;
            form.reset();
            $("add-section-id").value = sectionValue;

            await refreshData();
            showToast(`Dodano użytkownika: ${fullName(newUser)}`);
            phoneInput.focus();
        } catch (error) {
            console.error("Błąd podczas dodawania użytkownika:", error);
            showToast(`Nie udało się dodać użytkownika:\n${errorText(error)}`, "error");
        } finally {
            submitButton.disabled = false;
        }
    });
}

function initSectionForm() {
    const form = $("add-section-form");
    const nameInput = $("add-section-name");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const department = nameInput.value.trim();
        if (!department) return;

        const exists = state.sections.some(
            (section) => section.department.toLowerCase() === department.toLowerCase()
        );
        if (exists) {
            showToast(`Dział „${department}” już istnieje.`, "error");
            nameInput.focus();
            return;
        }

        const submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;

        try {
            const created = await api("/sections", {
                method: "POST",
                body: JSON.stringify({ department }),
            });
            const newId = created?.id ?? created?.data?.id ?? null;

            nameInput.value = "";
            await refreshData({ selectSectionId: newId }); // nowy dział od razu zaznaczony na liście
            showToast(`Dodano dział „${department}”.`);
        } catch (error) {
            console.error("Błąd podczas dodawania działu:", error);
            showToast(`Nie udało się dodać działu: ${errorText(error)}`, "error");
        } finally {
            submitButton.disabled = false;
        }
    });
}

// Funkcja edytowania danych użytkownika (przycisk „Edit”) jest obecnie wyłączona, więc nie implementujemy jej w tym momencie.
/* =========================================================
   EDYCJA UŻYTKOWNIKA
   ========================================================= */

let editingId = null;

function openEditDialog(id) {
    const user = state.users.find((u) => String(u.id) === String(id));
    if (!user) {
        showToast("Nie znaleziono użytkownika. Odśwież dane.", "error");
        return;
    }

    editingId = user.id;
    $("edit-id-label").textContent = `(ID: ${user.id})`;

    // lista działów
    const select = $("edit-section-id");
    select.innerHTML = '<option value="" disabled>Wybierz dział...</option>';
    [...state.sections]
        .sort((a, b) => a.department.localeCompare(b.department, "pl"))
        .forEach((section) => {
            const option = document.createElement("option");
            option.value = section.id;
            option.textContent = section.department;
            select.appendChild(option);
        });
    select.value = user.section?.id ?? user.section_id ?? "";

    $("edit-phone").value = user.phone_number || "";
    $("edit-room").value = user.details?.room_number || "";
    $("edit-designation").value = user.designation || "";
    $("edit-name").value = user.name || "";
    $("edit-last-name").value = user.last_name || "";
    $("edit-email").value = user.email || "";
    $("edit-ip").value = user.details?.ip_number || "";

    $("edit-dialog").showModal();
}

function initEditForm() {
    const dialog = $("edit-dialog");
    const form = $("edit-user-form");
    const saveButton = $("edit-save");
    const phoneInput = $("edit-phone");

    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^\d+\- ]/g, "");
    });

    $("edit-cancel").addEventListener("click", () => dialog.close());

    // kliknięcie w tło zamyka okno
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (editingId === null) return;

        const value = (id) => $(id).value.trim();
        const payload = {
            section_id: parseInt($("edit-section-id").value, 10),
            designation: value("edit-designation"),
            name: value("edit-name"),
            last_name: value("edit-last-name"),
            email: value("edit-email"),
            phone_number: value("edit-phone"),
            room_number: value("edit-room"),
            ip_number: value("edit-ip"),
        };

        const duplicates = findDuplicates(payload, editingId);
        if (duplicates.length > 0) {
            const proceed = await confirmDialog({
                title: "Możliwy duplikat",
                message: duplicates.join("\n"),
                confirmLabel: "Zapisz mimo to",
                variant: "primary",
            });
            if (!proceed) return;
        }

        saveButton.disabled = true;

        try {
            await api(`/userdata/${encodeURIComponent(editingId)}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            dialog.close();
            editingId = null;
            await refreshData();
            showToast(`Zapisano zmiany: ${fullName(payload)}`);
        } catch (error) {
            console.error("Błąd podczas edycji użytkownika:", error);
            showToast(`Nie udało się zapisać zmian:\n${errorText(error)}`, "error");
        } finally {
            saveButton.disabled = false;
        }
    });
}

/* =========================================================
   START
   ========================================================= */

initTheme();
initPanelToggles();
initSearch();
initTableActions();
initUserForm();
initSectionForm();
initEditForm();
refreshData();