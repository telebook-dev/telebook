document.addEventListener("DOMContentLoaded", () => {

    const globalSearch = document.getElementById("global-search");
    const clearSearch = document.getElementById("clear-search");
    const searchInfo = document.getElementById("search-info");
    const groups = [...document.querySelectorAll(".table-group")];


    function normalize(text) {
        // Zamienia tekst na małe litery i usuwa polskie znaki (ł → l, ó → o itd.).
        return text
            .toLowerCase()
            .replace(/ł/g, "l")
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function matchesAllWords(text, query) {
        // Dzieli frazę na słowa i sprawdza, czy każde występuje w tekście (kolejność bez znaczenia).
        return query
            .split(/\s+/)
            .filter(Boolean)
            .every(word => text.includes(word));
    }


    function getEmptyRow(table) {
        // Zwraca wiersz "Brak wyników" z tabeli; jeśli go nie ma, tworzy go.
        let emptyRow = table.querySelector(".empty-row");

        if (!emptyRow) {
            const columns = table.querySelectorAll("thead tr:first-child th").length;

            emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";
            emptyRow.innerHTML =
                `<td colspan="${columns}">Brak wyników dla wybranych filtrów</td>`;

            table.querySelector("tbody").appendChild(emptyRow);
        }

        return emptyRow;
    }


        function rowMatches(row, filters, globalValue, departmentName) {
    // Wyszukiwarka globalna: każde słowo musi wystąpić w danych wiersza LUB w nazwie działu
    // (kolejność bez znaczenia). Filtry kolumnowe: Id = dokładne dopasowanie, reszta = każde słowo.
    const cells = [...row.cells].filter(
        cell => !cell.classList.contains("actions")
    );

    const isPublic = document.body.classList.contains("public-view");

    // W widoku publicznym pomijamy kolumny tylko dla admina (Id, Ip)
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
        // Filtruje jedną tabelę, pokazuje/ukrywa wiersze i komunikat o braku wyników,
        // ustawia stan działu (czerwony / ukryty) i zwraca liczbę widocznych osób.
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
        // Przechodzi po wszystkich działach, sumuje wyniki i odświeża informację nad tabelami.
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
        // Wyświetla liczbę widocznych użytkowników lub wynik wyszukiwania globalnego.
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
        // Czyści wyszukiwarkę oraz wszystkie filtry kolumnowe i odświeża widok.
        globalSearch.value = "";

        document
            .querySelectorAll(".filter-input")
            .forEach(input => {
                input.value = "";
            });

        filterAll();
        globalSearch.focus();
    }


    globalSearch.addEventListener("input", filterAll);

    document
        .querySelectorAll(".filter-input")
        .forEach(input => input.addEventListener("input", filterAll));

    clearSearch.addEventListener("click", clearAll);

    filterAll();

});



const themeToggle = document.getElementById("theme-toggle");
const adminToggle = document.getElementById("admin-toggle");
const body = document.body;

// Kolumny widoczne tylko dla admina: Id (0), Ip (7), Akcje (8)
const ADMIN_COLUMNS = [0, 7, 8];

// Oznacza te kolumny (nagłówki, filtry i dane) we wszystkich tabelach
document.querySelectorAll(".table-data tr").forEach(row => {
    if (row.classList.contains("empty-row")) return;

    [...row.cells].forEach((cell, index) => {
        if (ADMIN_COLUMNS.includes(index)) {
            cell.classList.add("admin-only");
        }
    });
});


themeToggle.addEventListener("change", () => {
    body.classList.toggle("dark-mode", themeToggle.checked);
});


adminToggle.addEventListener("change", () => {
    const isPublic = !adminToggle.checked;

    body.classList.toggle("public-view", isPublic);

    if (isPublic) {
        // Czyścimy filtry ukrytych kolumn, żeby nie działały "niewidocznie"
        document
            .querySelectorAll(".filter-row .admin-only .filter-input")
            .forEach(input => {
                input.value = "";
            });
    }

    // Odświeżenie wyników (uwzględnia też wyszukiwarkę globalną)
    globalSearchRefresh();
});

function globalSearchRefresh() {
    document
        .getElementById("global-search")
        .dispatchEvent(new Event("input"));
}