const API = "http://localhost:8000/api";

document.addEventListener("DOMContentLoaded", () => {
    getData();
    loadSections();

    // 2. Obsługa przełącznika trybu ciemnego
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    if (themeToggle) {
        themeToggle.addEventListener("change", () => {
            body.classList.toggle("dark-mode", themeToggle.checked);
        });
    }

    // 3. Obsługa przełącznika widoku admina
    const adminToggle = document.getElementById("admin-toggle");
    if (adminToggle) {
        adminToggle.addEventListener("change", () => {
            const isPublic = !adminToggle.checked;
            body.classList.toggle("public-view", isPublic);

            if (isPublic) {
                document.querySelectorAll(".filter-row .admin-only .filter-input").forEach(input => {
                    input.value = "";
                });
            }

            const globalSearch = document.getElementById("global-search");
            if (globalSearch) {
                globalSearch.dispatchEvent(new Event("input"));
            }
        });
    }
});

// 4. Obsługa formularza dodawania użytkownika
    const addUserForm = document.getElementById("add-user-form");
    if (addUserForm) {
        addUserForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newUser = {
            section_id: parseInt(document.getElementById("add-section-id").value),
            designation: document.getElementById("add-designation").value,
            name: document.getElementById("add-name").value,
            last_name: document.getElementById("add-last-name").value,
            email: document.getElementById("add-email").value,
            phone_number: document.getElementById("add-phone").value,
            room_number: document.getElementById("add-room").value,
            ip_number: document.getElementById("add-ip").value
        };

            try {
                const response = await fetch("http://localhost:8000/api/userdata", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(newUser)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const details = errorData.errors
                        ? Object.values(errorData.errors).flat().join("\n")
                        : errorData.message;
                    throw new Error(details || `Status: ${response.status}`);
                }

                addUserForm.reset();
                await getData();
                alert("Użytkownik został pomyślnie dodany!");
            } catch (error) {
                console.error("Błąd podczas dodawania użytkownika:", error);
                alert(`Nie udało się dodać użytkownika: ${error.message}`);
            }
        });
    }


async function loadSections(selectId = null) {
    try {
        const response = await fetch(`${API}/sections`, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const json = await response.json();
        const sections = Array.isArray(json) ? json : json.data;
        populateSectionSelect(sections, selectId);
    } catch (error) {
        console.error("Błąd podczas pobierania działów:", error);
    }
}

function populateSectionSelect(sections, selectId = null) {
    const select = document.getElementById("add-section-id");
    if (!select) return;

    const previous = selectId ?? select.value;

    select.innerHTML = '<option value="" disabled selected>Wybierz dział...</option>';

    [...sections]
        .sort((a, b) => a.department.localeCompare(b.department, "pl"))
        .forEach(section => {
            const option = document.createElement("option");
            option.value = section.id;
            option.textContent = section.department;
            select.appendChild(option);
        });

    if (previous) select.value = previous;
}

// Telefon: tylko cyfry, spacje, + i -
const phoneInput = document.getElementById("add-phone");
if (phoneInput) {
    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^\d+\- ]/g, "");
    });
}

// Dodawanie nowego działu
const addSectionForm = document.getElementById("add-section-form");
if (addSectionForm) {
    addSectionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("add-section-name");
        const department = nameInput.value.trim();
        if (!department) return;

        try {
            const response = await fetch(`${API}/sections`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ department })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Status: ${response.status}`);
            }

            const created = await response.json();
            const newId = created.id ?? created.data?.id;

            nameInput.value = "";
            await loadSections(newId); // odśwież listę i od razu zaznacz nowy dział
        } catch (error) {
            console.error("Błąd podczas dodawania działu:", error);
            alert(`Nie udało się dodać działu: ${error.message}`);
        }
    });
}

// Pobieranie danych z API i generowanie struktury
async function getData() {
    const url = "http://localhost:8000/api/userdata";
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();

        // najpierw wszystkie działy (także puste)
        const sectionsResp = await fetch(`${API}/sections`, { headers: { "Accept": "application/json" } });
        if (!sectionsResp.ok) throw new Error(`Sections status: ${sectionsResp.status}`);
        const allSections = await sectionsResp.json();

        const departmentsMap = {};
        const sectionIds = {};   // nazwa -> id

        allSections
            .sort((a, b) => a.department.localeCompare(b.department, "pl"))
            .forEach(s => {
                departmentsMap[s.department] = [];
                sectionIds[s.department] = s.id;
            });

        // potem użytkownicy
        result.forEach(data => {
            const department = data.section?.department || 'Brak działu';
            if (!departmentsMap[department]) {
                departmentsMap[department] = [];
            }
            departmentsMap[department].push(data);
        });

        let allTablesHTML = "";

        for (const [deptName, users] of Object.entries(departmentsMap)) {
            let rowsHTML = "";
            const sectionId = sectionIds[deptName];
            const canDelete = users.length === 0 && sectionId !== undefined;

            users.forEach(data => {
                let user_id = data.id || '';
                let phone = data.phone_number || '';
                let room = data.details?.room_number || '';
                let designation = data.designation || '';
                let name = data.name || '';
                let last_name = data.last_name || '';
                let email = data.email || '';
                let ip = data.details?.ip_number || '';

                rowsHTML += `
                    <tr>
                        <td class="admin-only">${user_id}</td>
                        <td>${phone}</td>
                        <td>${room}</td>
                        <td>${designation}</td>
                        <td>${name}</td>
                        <td>${last_name}</td>
                        <td>${email}</td>
                        <td class="admin-only">${ip}</td>
                        <td class="actions admin-only">
                            <button class="edit-button">Edit</button>
                            <button class="delete-button" data-id=${user_id}>Delete</button>
                        </td>
                    </tr>
                `;
            });

                allTablesHTML += `
                <div class="table-group">
                    <div class="table-header">
                        <h2 class="table-name">${deptName}</h2>
                        ${canDelete ? `
                            <button class="delete-section-button admin-only"
                                    data-section-id="${sectionId}"
                                    data-section-name="${deptName}">
                                Usuń dział
                            </button>` : ""}
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
                                    <th class="admin-only"><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th><input type="text" class="filter-input" placeholder="Filtruj"></th>
                                    <th class="admin-only"><input type="text" class="filter-input" placeholder="Filtruj"></th>
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

        // Wstrzykujemy tabele do DOM
        document.getElementById('dynamic-tables-container').innerHTML = allTablesHTML;

        // 4. Inicjalizujemy wyszukiwarkę i filtry dopiero TERAZ, kiedy tabele już istnieją w HTML!
        initSearchAndFilters();

    } catch (error) {
        console.error("Błąd podczas pobierania danych:", error.message);
    }
}

// Logika filtrowania i wyszukiwania
function initSearchAndFilters() {
    const globalSearch = document.getElementById("global-search");
    const clearSearch = document.getElementById("clear-search");
    const searchInfo = document.getElementById("search-info");
    const groups = [...document.querySelectorAll(".table-group")];

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
            const visibleColumns = [...table.querySelectorAll("thead tr:first-child th")]
                .filter(th => window.getComputedStyle(th).display !== "none").length;

            emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";
            emptyRow.innerHTML = `<td colspan="${visibleColumns}">Brak wyników dla wybranych filtrów</td>`;

            table.querySelector("tbody").appendChild(emptyRow);
        }

        return emptyRow;
    }

    function rowMatches(row, filters, globalValue, departmentName) {
        const cells = [...row.cells].filter(cell => !cell.classList.contains("actions"));
        const isPublic = document.body.classList.contains("public-view");

        const rowText = normalize(
            cells
                .filter(cell => !(isPublic && cell.classList.contains("admin-only")))
                .map(cell => cell.textContent)
                .join(" ")
            + " " + departmentName
        );

        if (globalValue && !matchesAllWords(rowText, globalValue)) {
            return false;
        }

        return filters.every((filter, index) => {
            const value = normalize(filter.value);
            if (!value) return true;

            const cell = cells[index];
            if (!cell) return false;

            const cellText = normalize(cell.textContent);

            return index === 0 ? cellText === value : matchesAllWords(cellText, value);
        });
    }

    function filterGroup(group, globalValue) {
        const table = group.querySelector(".table-data");
        const rows = [...table.querySelectorAll("tbody tr:not(.empty-row)")];
        const filters = [...table.querySelectorAll(".filter-input")];
        const departmentName = group.querySelector(".table-name").textContent;

        let visibleInGroup = 0;

        rows.forEach(row => {
            const visible = rowMatches(row, filters, globalValue, departmentName);
            row.style.display = visible ? "" : "none";
            row.classList.toggle("search-match", visible && globalValue !== "");

            if (visible) {
                visibleInGroup++;
            }
        });

        getEmptyRow(table).style.display = visibleInGroup === 0 ? "" : "none";

        const hasColumnFilters = filters.some(f => f.value.trim() !== "");

        group.classList.toggle(
            "no-results",
            visibleInGroup === 0 && (hasColumnFilters || globalValue !== "")
        );

        group.style.display =
            globalValue && visibleInGroup === 0 && !hasColumnFilters ? "none" : "";

        return visibleInGroup;
    }

    function filterAll() {
        const globalValue = normalize(globalSearch.value);
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
        if (total === 0) {
            searchInfo.textContent = "Nie znaleziono użytkowników";
            return;
        }

        if (!globalValue) {
            searchInfo.textContent = `Widocznych użytkowników: ${total}`;
            return;
        }

        const userWord = total === 1 ? "użytkownika" : "użytkowników";
        const groupWord = groupsCount === 1 ? "dziale" : "działach";

        searchInfo.textContent = `Znaleziono ${total} ${userWord} w ${groupsCount} ${groupWord}`;
    }

    function clearAll() {
        globalSearch.value = "";
        document.querySelectorAll(".filter-input").forEach(input => {
            input.value = "";
        });
        filterAll();
        globalSearch.focus();
    }

    // Nasłuchiwanie zdarzeń
    globalSearch.addEventListener("input", filterAll);
    document.querySelectorAll(".filter-input").forEach(input => {
        input.addEventListener("input", filterAll);
    });
    clearSearch.addEventListener("click", clearAll);

    // Pierwsze uruchomienie filtrowania po załadowaniu danych
    filterAll();


    document.addEventListener("click", async (event) => {
    // usuwanie użytkownika
    if (event.target.classList.contains("delete-button")) {
        const userId = event.target.getAttribute("data-id");
        if (!userId) return;
        if (!confirm(`Czy na pewno chcesz usunąć użytkownika o ID: ${userId}`)) return;

        try {
            const response = await fetch(`${API}/userdata/${userId}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`Błąd usuwania. Status: ${response.status}`);
            await getData();
        } catch (error) {
            console.error("Nie udało się usunąć użytkownika: ", error);
            alert("Wystąpił błąd podczas usuwania użytkownika");
        }
        return;
    }

    // usuwanie działu
    if (event.target.classList.contains("delete-section-button")) {
        const id = event.target.dataset.sectionId;
        const name = event.target.dataset.sectionName;
        if (!confirm(`Czy na pewno chcesz usunąć dział „${name}"?`)) return;

        try {
            const response = await fetch(`${API}/sections/${id}`, {
                method: "DELETE",
                headers: { "Accept": "application/json" }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `Status: ${response.status}`);
            }
            await getData();
            await loadSections();
        } catch (error) {
            console.error("Błąd usuwania działu:", error);
            alert(`Nie udało się usunąć działu: ${error.message}`);
        }
    }
});
}