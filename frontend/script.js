"use strict";

/* =========================================================
   KONFIGURACJA
   (skrypt jest ładowany na końcu <body>, więc elementy już istnieją)
   ========================================================= */

const API = "http://10.10.1.5:8000/api";
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
    sectionOrder: [],
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

function getOrderedSections() {
    const rank = new Map(state.sectionOrder.map((id, index) => [String(id), index]));

    return [...state.sections].sort((a, b) => {
        const ra = rank.has(String(a.id)) ? rank.get(String(a.id)) : Infinity;
        const rb = rank.has(String(b.id)) ? rank.get(String(b.id)) : Infinity;

        if (ra === rb) return a.department.localeCompare(b.department, "pl");
        return ra < rb ? -1 : 1;
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

// jedno odświeżenie = jeden komplet zapytań (użytkownicy + działy równolegle)
async function refreshData({ selectSectionId = null } = {}) {
    const token = ++refreshToken;

    try {
        const [users, sections, order] = await Promise.all([
            api("/userdata"),
            api("/sections"),
            api("/section-order").catch(() => []),
        ]);

        if (token !== refreshToken) return;

        state.users = unwrap(users);
        state.sections = unwrap(sections);
        state.sectionOrder = Array.isArray(order) ? order : unwrap(order);
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

// Pogrubia ostatnie 3 cyfry części numeru (przed dopiskiem fax/wew/itp.)
// Dopisek i reszta tekstu zostają bez zmian
function boldLastDigits(text) {
    const value = String(text ?? "");

    // pierwszy dopisek typu "fax", "FAX:", "wew.", "wew", "ext", "tel" (z granicą słowa)
    const suffixMatch = value.match(/\s*(?:-\s*)?\b(?:fax|wew|wew\.|ext|tel)\b/i);

    const splitAt = suffixMatch ? suffixMatch.index : value.length;
    const numberPart = value.slice(0, splitAt);
    const rest = value.slice(splitAt);

    // ostatnie 3 cyfry części z numerem (ignorujemy spacje i kropki na końcu)
    const match = numberPart.match(/^(.*?)(\d{3})(\D*)$/s);

    if (!match) return escapeHtml(value);

    const [, before, lastDigits, after] = match;
    return (
        `${escapeHtml(before)}<strong>${escapeHtml(lastDigits)}</strong>` +
        `${escapeHtml(after)}${escapeHtml(rest)}`
    );
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
        ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${boldLastDigits(phone)}</a>`
        : "";
    const emailCell = email
        ? email
            .split(/\s+/)
            .filter(Boolean)
            .map(e => `<a href="mailto:${escapeHtml(encodeURI(e))}">${escapeHtml(e)}</a>`)
            .join("<br>")
        : "";

    // IP jako link do noVNC (pulpit w przeglądarce) + osobny link do AnyDesk (aplikacja lokalna)
    // noVNC/websockify działa na porcie 6080 pod adresem hosta, na którym stoi panel (window.location.hostname)
    // Adres IP staje się klikalnym linkiem uruchamiającym AnyDesk
    let ipCell = "";
    if (ip) {
        const anydeskUrl = `anydesk:${encodeURIComponent(ip)}`;
        ipCell = `
            <a href="${escapeHtml(anydeskUrl)}" title="Połącz przez AnyDesk">${escapeHtml(ip)}</a>
        `;
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

function groupHTML(name, { id, users }, position = {}) {
    const safeName = escapeHtml(name);
    const canDelete = users.length === 0 && id !== undefined;
    const canMove = id !== undefined;

    const colgroup =
        COLUMN_WIDTHS.map((w) => `<col style="width:${w}%">`).join("") +
        `<col style="width:${ACTIONS_WIDTH}%">`;
    const headCells = COLUMNS.map((column) => `<th>${column}</th>`).join("");

    const moveButtons = canMove ? `
        <div class="move-buttons">
            <button type="button" class="move-button" data-action="move-section" data-dir="up"
                    data-section-id="${escapeHtml(id)}" title="Przesuń w górę"
                    aria-label="Przesuń dział w górę" ${position.isFirst ? "disabled" : ""}>↑</button>
            <button type="button" class="move-button" data-action="move-section" data-dir="down"
                    data-section-id="${escapeHtml(id)}" title="Przesuń w dół"
                    aria-label="Przesuń dział w dół" ${position.isLast ? "disabled" : ""}>↓</button>
        </div>` : "";

    return `
        <div class="table-group" data-dept="${safeName}">
            <div class="table-header">
                <div class="table-title">
                    <h2 class="table-name">${safeName}</h2>
                </div>
                <div class="table-header-actions">
                    ${moveButtons}
                    ${canDelete ? `
                        <button type="button" class="delete-section-button" data-action="delete-section"
                                data-section-id="${escapeHtml(id)}"
                                data-section-name="${safeName}">Usuń dział</button>` : ""}
                </div>
            </div>

            <div class="table-container">
                <table class="table-data">
                    <colgroup>${colgroup}</colgroup>
                    <thead>
                        <tr>${headCells}<th>Akcje</th></tr>
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

let savingOrder = false;

async function moveSection(button) {
    if (savingOrder) return;

    const id = String(button.dataset.sectionId);
    const step = button.dataset.dir === "up" ? -1 : 1;

    const ids = getOrderedSections().map((section) => String(section.id));
    const from = ids.indexOf(id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return;

    [ids[from], ids[to]] = [ids[to], ids[from]];

    const previous = state.sectionOrder;
    state.sectionOrder = ids;
    renderGroups(); // zmiana widoczna od razu

    savingOrder = true;
    try {
        await api("/section-order", {
            method: "PUT",
            body: JSON.stringify({ order: ids.map(Number) }),
        });
    } catch (error) {
        console.error("Nie udało się zapisać kolejności:", error);
        state.sectionOrder = previous; // cofamy zmianę
        renderGroups();
        showToast(`Nie udało się zapisać kolejności: ${errorText(error)}`, "error");
    } finally {
        savingOrder = false;
    }
}

function renderGroups() {
    const scrollY = window.scrollY;
    const groups = new Map();

    getOrderedSections().forEach((section) => {
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

    const entries = [...groups];
    const sectionEntries = entries.filter(([, g]) => g.id !== undefined);
    const firstId = sectionEntries[0]?.[1].id;
    const lastId = sectionEntries.at(-1)?.[1].id;

    container.innerHTML = entries
        .map(([name, group]) =>
            groupHTML(name, group, {
                isFirst: group.id !== undefined && group.id === firstId,
                isLast: group.id !== undefined && group.id === lastId,
            })
        )
        .join("");

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

function rowMatches(cells, department, words) {
    const rowText = `${cells.join(" ")} ${department}`;
    return words.every((word) => rowText.includes(word));
}

function filterGroup(group, words) {
    const table = group.querySelector(".table-data");
    const department = normalize(group.dataset.dept);
    const rows = [...table.querySelectorAll("tbody tr:not(.empty-row)")];

    let visible = 0;

    rows.forEach((row) => {
        const match = rowMatches(rowCells(row), department, words);
        row.hidden = !match;
        row.classList.toggle("search-match", match && words.length > 0);
        if (match) visible++;
    });

    const emptyRow = table.querySelector(".empty-row");
    emptyRow.hidden = visible !== 0;
    emptyRow.firstElementChild.textContent =
        rows.length === 0
            ? "Ten dział nie ma jeszcze użytkowników"
            : "Brak wyników dla wyszukiwania";

    group.classList.toggle("no-results", rows.length > 0 && visible === 0 && words.length > 0);
    group.hidden = words.length > 0 && visible === 0;

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
    applyFilters();
    globalSearch.focus();
}   

function initSearch() {
    globalSearch.addEventListener("input", applyFilters);
    clearSearch.addEventListener("click", clearAllFilters);
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
            case "move-section":
                await moveSection(button);
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