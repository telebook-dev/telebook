const API_URL = "http://localhost:8000/api";
const API = API_URL;

// ==========================================
// INICJALIZACJA
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    getData();
    loadSections();

    // Tryb ciemny
    const themeToggle = document.getElementById("theme-toggle");

    if (themeToggle) {
        themeToggle.addEventListener("change", () => {
            document.body.classList.toggle(
                "dark-mode",
                themeToggle.checked
            );
        });
    }

    // Widok administratora / publiczny
    const adminToggle = document.getElementById("admin-toggle");

    if (adminToggle) {
        adminToggle.addEventListener("change", () => {
            const isPublic = !adminToggle.checked;

            document.body.classList.toggle("public-view", isPublic);

            if (isPublic) {
                document
                    .querySelectorAll(
                        ".filter-row .admin-only .filter-input"
                    )
                    .forEach(input => {
                        input.value = "";
                    });
            }

            const globalSearch =
                document.getElementById("global-search");

            if (globalSearch) {
                globalSearch.dispatchEvent(new Event("input"));
            }
        });
    }

    // Dodawanie użytkownika
    const addUserForm = document.getElementById("add-user-form");

    if (addUserForm) {
        addUserForm.addEventListener("submit", async event => {
            event.preventDefault();

            const sectionId =
                document.getElementById("add-section-id").value;

            const newUser = {
                section_id: Number.parseInt(sectionId, 10),
                designation:
                document.getElementById("add-designation").value,
                name:
                document.getElementById("add-name").value,
                last_name:
                document.getElementById("add-last-name").value,
                email:
                document.getElementById("add-email").value,
                phone_number:
                document.getElementById("add-phone").value,
                room_number:
                document.getElementById("add-room").value,
                ip_number:
                document.getElementById("add-ip").value
            };

            try {
                const response = await fetch(`${API_URL}/userdata`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify(newUser)
                });

                if (response.status === 401) {
                    window.location.replace("admin-login.html");
                    return;
                }

                if (!response.ok) {
                    const errorData =
                        await response.json().catch(() => ({}));

                    const details = errorData.errors
                        ? Object.values(errorData.errors).flat().join("\n")
                        : errorData.message;

                    throw new Error(
                        details || `Status: ${response.status}`
                    );
                }

                addUserForm.reset();

                await getData();
                await loadSections();

                alert("Użytkownik został pomyślnie dodany!");
            } catch (error) {
                console.error("Błąd podczas dodawania użytkownika:", error);

                alert(
                    `Nie udało się dodać użytkownika: ${error.message}`
                );
            }
        });
    }

    // Ograniczenie znaków w numerze telefonu
    const phoneInput = document.getElementById("add-phone");

    if (phoneInput) {
        phoneInput.addEventListener("input", () => {
            phoneInput.value = phoneInput.value.replace(/[^\d+\- ]/g, "");
        });
    }

    // Dodawanie działu
    const addSectionForm =
        document.getElementById("add-section-form");

    if (addSectionForm) {
        addSectionForm.addEventListener("submit", async event => {
            event.preventDefault();

            const nameInput =
                document.getElementById("add-section-name");

            const department = nameInput.value.trim();

            if (!department) {
                return;
            }

            try {
                const response = await fetch(`${API_URL}/sections`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({ department })
                });

                if (response.status === 401) {
                    window.location.replace("admin-login.html");
                    return;
                }

                if (!response.ok) {
                    const errorData =
                        await response.json().catch(() => ({}));

                    throw new Error(
                        errorData.message || `Status: ${response.status}`
                    );
                }

                const created = await response.json();
                const newId = created.id ?? created.data?.id;

                nameInput.value = "";

                await loadSections(newId);
                await getData();
            } catch (error) {
                console.error("Błąd podczas dodawania działu:", error);

                alert(
                    `Nie udało się dodać działu: ${error.message}`
                );
            }
        });
    }
});

// ==========================================
// OBSŁUGA SEKCJI / DZIAŁÓW
// ==========================================

async function loadSections(selectId = null) {
    try {
        const response = await fetch(`${API_URL}/sections`, {
            headers: {
                "Accept": "application/json"
            },
            credentials: "include"
        });

        if (response.status === 401) {
            window.location.replace("admin-login.html");
            return;
        }

        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }

        const json = await response.json();
        const sections = Array.isArray(json) ? json : json.data;

        if (!Array.isArray(sections)) {
            throw new Error("Nieprawidłowy format danych działów.");
        }

        populateSectionSelect(sections, selectId);
    } catch (error) {
        console.error("Błąd podczas pobierania działów:", error);
    }
}

function populateSectionSelect(sections, selectId = null) {
    const select = document.getElementById("add-section-id");

    if (!select) {
        return;
    }

    const previous = selectId ?? select.value;

    select.innerHTML =
        '<option value="" disabled>Wybierz dział...</option>';

    [...sections]
        .sort((a, b) =>
            a.department.localeCompare(b.department, "pl")
        )
        .forEach(section => {
            const option = document.createElement("option");

            option.value = section.id;
            option.textContent = section.department;

            select.appendChild(option);
        });

    if (previous != null && previous !== "") {
        select.value = String(previous);
    } else {
        select.selectedIndex = 0;
    }
}

// ==========================================
// POBIERANIE DANYCH I GENEROWANIE TABEL
// ==========================================

async function getData() {
    try {
        const response = await fetch(`${API_URL}/userdata`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "include"
        });

        if (response.status === 401) {
            window.location.replace("admin-login.html");
            return;
        }

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        const users = Array.isArray(json) ? json : json.data;

        if (!Array.isArray(users)) {
            throw new Error("Nieprawidłowy format danych użytkowników.");
        }

        // Pobranie wszystkich działów, również pustych
        const sectionsResponse = await fetch(`${API_URL}/sections`, {
            headers: {
                "Accept": "application/json"
            },
            credentials: "include"
        });

        if (sectionsResponse.status === 401) {
            window.location.replace("admin-login.html");
            return;
        }

        if (!sectionsResponse.ok) {
            throw new Error(
                `Sections status: ${sectionsResponse.status}`
            );
        }

        const sectionsJson = await sectionsResponse.json();

        const allSections = Array.isArray(sectionsJson)
            ? sectionsJson
            : sectionsJson.data;

        if (!Array.isArray(allSections)) {
            throw new Error("Nieprawidłowy format danych działów.");
        }

        const departmentsMap = {};
        const sectionIds = {};

        [...allSections]
            .sort((a, b) =>
                a.department.localeCompare(b.department, "pl")
            )
            .forEach(section => {
                departmentsMap[section.department] = [];
                sectionIds[section.department] = section.id;
            });

        // Przypisanie użytkowników do działów
        users.forEach(user => {
            const department =
                user.section?.department || "Brak działu";

            if (!departmentsMap[department]) {
                departmentsMap[department] = [];
            }

            departmentsMap[department].push(user);
        });

        let allTablesHTML = "";

        for (const [departmentName, departmentUsers]
            of Object.entries(departmentsMap)) {

            let rowsHTML = "";

            const sectionId = sectionIds[departmentName];

            const canDelete =
                departmentUsers.length === 0 &&
                sectionId !== undefined;

            departmentUsers.forEach(user => {
                const userId = user.id ?? "";
                const phone = user.phone_number ?? "";
                const room = user.details?.room_number ?? "";
                const designation = user.designation ?? "";
                const name = user.name ?? "";
                const lastName = user.last_name ?? "";
                const email = user.email ?? "";
                const ip = user.details?.ip_number ?? "";

                rowsHTML += `
                    <tr>
                        <td class="admin-only">${userId}</td>
                        <td>${phone}</td>
                        <td>${room}</td>
                        <td>${designation}</td>
                        <td>${name}</td>
                        <td>${lastName}</td>
                        <td>${email}</td>
                        <td class="admin-only">${ip}</td>
                        <td class="actions admin-only">
                            <button class="edit-button">Edit</button>
                            <button
                                class="delete-button"
                                data-id="${userId}"
                            >
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            });

            allTablesHTML += `
                <div class="table-group">
                    <div class="table-header">
                        <h2 class="table-name">${departmentName}</h2>

                        ${canDelete ? `
                            <button
                                class="delete-section-button admin-only"
                                data-section-id="${sectionId}"
                                data-section-name="${departmentName}"
                            >
                                Usuń dział
                            </button>
                        ` : ""}
                    </div>

                    <div class="table-container">
                        <table class="table-data">
                            <thead>
                                <tr>
                                    <th class="admin-only">Id</th>
                                    <th>Nr telefonu</th>
                                    <th>Nr pokoju</th>
                                    <th>Oznaczenie użytkownika</th>
                                    <th>Imię</th>
                                    <th>Nazwisko</th>
                                    <th>Adres pocztowy elektroniczny</th>
                                    <th class="admin-only">Ip</th>
                                    <th class="admin-only">Akcje</th>
                                </tr>

                                <tr class="filter-row">
                                    <th class="admin-only">
                                        <input
                                            type="text"
                                            class="filter-input"
                                            placeholder="Filtruj"
                                        >
                                    </th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th class="admin-only">
                                        <input
                                            type="text"
                                            class="filter-input"
                                            placeholder="Filtruj"
                                        >
                                    </th>
                                    <th class="admin-only"></th>
                                </tr>
                            </thead>

                            <tbody>
                                ${rowsHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const container =
            document.getElementById("dynamic-tables-container");

        if (!container) {
            throw new Error("Nie znaleziono kontenera tabel.");
        }

        container.innerHTML = allTablesHTML;

        initSearchAndFilters();

        document.body.classList.remove("auth-checking");
    } catch (error) {
        console.error(
            "Błąd podczas pobierania danych:",
            error.message
        );

        // Błędy sieci nie muszą oznaczać braku autoryzacji.
        // Nie przekierowujemy automatycznie przy każdym błędzie.
    }
}

// ==========================================
// WYSZUKIWANIE I FILTROWANIE
// ==========================================

function initSearchAndFilters() {
    const globalSearch = document.getElementById("global-search");
    const clearSearch = document.getElementById("clear-search");
    const searchInfo = document.getElementById("search-info");

    const groups = [
        ...document.querySelectorAll(".table-group")
    ];

    function normalize(text) {
        return text
            .toLowerCase()
            .replace(/ł/g, "l")
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function matchesAllWords(text, query) {
        return query
            .split(/\s+/)
            .filter(Boolean)
            .every(word => text.includes(word));
    }

    function getEmptyRow(table) {
        let emptyRow = table.querySelector(".empty-row");

        if (!emptyRow) {
            const visibleColumns = [
                ...table.querySelectorAll("thead tr:first-child th")
            ].filter(th =>
                window.getComputedStyle(th).display !== "none"
            ).length;

            emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";

            const cell = document.createElement("td");
            cell.colSpan = visibleColumns;
            cell.textContent =
                "Brak wyników dla wybranych filtrów";

            emptyRow.appendChild(cell);
            table.querySelector("tbody").appendChild(emptyRow);
        }

        return emptyRow;
    }

    function rowMatches(row, filters, globalValue, departmentName) {
        const cells = [
            ...row.cells
        ].filter(cell => !cell.classList.contains("actions"));

        const isPublic =
            document.body.classList.contains("public-view");

        const rowText = normalize(
            cells
                .filter(cell =>
                    !(isPublic && cell.classList.contains("admin-only"))
                )
                .map(cell => cell.textContent)
                .join(" ") + " " + departmentName
        );

        if (
            globalValue &&
            !matchesAllWords(rowText, globalValue)
        ) {
            return false;
        }

        return filters.every((filter, index) => {
            const value = normalize(filter.value);

            if (!value) {
                return true;
            }

            const cell = cells[index];

            if (!cell) {
                return false;
            }

            const cellText = normalize(cell.textContent);

            return index === 0
                ? cellText === value
                : matchesAllWords(cellText, value);
        });
    }

    function filterGroup(group, globalValue) {
        const table = group.querySelector(".table-data");

        const rows = [
            ...table.querySelectorAll(
                "tbody tr:not(.empty-row)"
            )
        ];

        const filters = [
            ...table.querySelectorAll(".filter-input")
        ];

        const departmentName =
            group.querySelector(".table-name").textContent;

        let visibleInGroup = 0;

        rows.forEach(row => {
            const visible = rowMatches(
                row,
                filters,
                globalValue,
                departmentName
            );

            row.style.display = visible ? "" : "none";

            row.classList.toggle(
                "search-match",
                visible && globalValue !== ""
            );

            if (visible) {
                visibleInGroup++;
            }
        });

        getEmptyRow(table).style.display =
            visibleInGroup === 0 ? "" : "none";

        const hasColumnFilters = filters.some(
            filter => filter.value.trim() !== ""
        );

        group.classList.toggle(
            "no-results",
            visibleInGroup === 0 &&
            (hasColumnFilters || globalValue !== "")
        );

        group.style.display =
            globalValue &&
            visibleInGroup === 0 &&
            !hasColumnFilters
                ? "none"
                : "";

        return visibleInGroup;
    }

    function filterAll() {
        const globalValue = normalize(
            globalSearch?.value ?? ""
        );

        let totalVisible = 0;
        let visibleGroups = 0;

        groups.forEach(group => {
            const count = filterGroup(group, globalValue);

            if (count > 0) {
                totalVisible += count;
                visibleGroups++;
            }
        });

        updateInfo(globalValue, totalVisible, visibleGroups);
    }

    function updateInfo(globalValue, total, groupsCount) {
        if (!searchInfo) {
            return;
        }

        if (total === 0) {
            searchInfo.textContent =
                "Nie znaleziono użytkowników";
            return;
        }

        if (!globalValue) {
            searchInfo.textContent =
                `Widocznych użytkowników: ${total}`;
            return;
        }

        const userWord =
            total === 1 ? "użytkownika" : "użytkowników";

        const groupWord =
            groupsCount === 1 ? "dziale" : "działach";

        searchInfo.textContent =
            `Znaleziono ${total} ${userWord} w ${groupsCount} ${groupWord}`;
    }

    function clearAll() {
        if (globalSearch) {
            globalSearch.value = "";
        }

        document
            .querySelectorAll(".filter-input")
            .forEach(input => {
                input.value = "";
            });

        filterAll();
        globalSearch?.focus();
    }

    if (globalSearch) {
        globalSearch.addEventListener("input", filterAll);
    }

    document
        .querySelectorAll(".filter-input")
        .forEach(input => {
            input.addEventListener("input", filterAll);
        });

    if (clearSearch) {
        clearSearch.addEventListener("click", clearAll);
    }

    filterAll();
}

// ==========================================
// USUWANIE UŻYTKOWNIKÓW I DZIAŁÓW
// Listener jest rejestrowany tylko raz.
// ==========================================

document.addEventListener("click", async event => {
    const target = event.target;

    if (!(target instanceof Element)) {
        return;
    }

    // Usuwanie użytkownika
    const userButton = target.closest(".delete-button");

    if (userButton) {
        const userId = userButton.dataset.id;

        if (!userId) {
            return;
        }

        if (
            !confirm(
                `Czy na pewno chcesz usunąć użytkownika o ID: ${userId}?`
            )
        ) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/userdata/${userId}`,
                {
                    method: "DELETE",
                    headers: {
                        "Accept": "application/json"
                    },
                    credentials: "include"
                }
            );

            if (response.status === 401) {
                window.location.replace("admin-login.html");
                return;
            }

            if (!response.ok) {
                throw new Error(`Status: ${response.status}`);
            }

            await getData();
        } catch (error) {
            console.error(
                "Nie udało się usunąć użytkownika:",
                error
            );

            alert("Wystąpił błąd podczas usuwania użytkownika.");
        }

        return;
    }

    // Usuwanie działu
    const sectionButton =
        target.closest(".delete-section-button");

    if (sectionButton) {
        const id = sectionButton.dataset.sectionId;
        const name = sectionButton.dataset.sectionName;

        if (!id) {
            return;
        }

        if (
            !confirm(
                `Czy na pewno chcesz usunąć dział „${name}”?`
            )
        ) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/sections/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Accept": "application/json"
                    },
                    credentials: "include"
                }
            );

            if (response.status === 401) {
                window.location.replace("admin-login.html");
                return;
            }

            if (!response.ok) {
                const errorData =
                    await response.json().catch(() => ({}));

                throw new Error(
                    errorData.message || `Status: ${response.status}`
                );
            }

            await getData();
            await loadSections();
        } catch (error) {
            console.error("Błąd usuwania działu:", error);

            alert(
                `Nie udało się usunąć działu: ${error.message}`
            );
        }
    }
});

// ==========================================
// WYLOGOWANIE ADMINISTRATORA
// ==========================================

async function logout() {
    try {
        const response = await fetch(`${API_URL}/logout`, {
            method: "POST",
            headers: {
                "Accept": "application/json"
            },
            credentials: "include"
        });

        if (!response.ok && response.status !== 401) {
            throw new Error(`Status: ${response.status}`);
        }
    } catch (error) {
        console.error(
            "Błąd połączenia przy wylogowaniu:",
            error
        );
    } finally {
        window.location.replace("admin-login.html");
    }
}

window.logout = logout;