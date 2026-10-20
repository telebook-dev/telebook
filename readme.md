# TeleBook

Panel administracyjny do zarządzania książką telefoniczną firmy: użytkownicy pogrupowani w działy, wyszukiwarka globalna, filtry kolumn, edycja, usuwanie, kontrola duplikatów oraz szybkie łączenie ze stanowiskiem przez AnyDesk (kliknięcie w adres IP).

- **Backend:** Laravel (REST API pod `/api`) + PostgreSQL
- **Frontend:** statyczne pliki HTML / CSS / vanilla JS, bez frameworka
- **Logowanie:** sesja (cookie) – frontend wysyła `credentials: "include"`, a przy odpowiedzi `401` przekierowuje na `admin-login.html`

---

## Spis treści

0. [Struktura projektu – co robi każdy plik](#0-struktura-projektu--co-robi-każdy-plik)
1. [Wymagania](#1-wymagania)
2. [Klonowanie repozytorium](#2-klonowanie-repozytorium)
3. [Baza PostgreSQL](#3-baza-postgresql)
4. [Konfiguracja Laravela (`.env`)](#4-konfiguracja-laravela-env)
5. [Instalacja pakietów i migracje](#5-instalacja-pakietów-i-migracje)
6. [Uruchomienie lokalne](#6-uruchomienie-lokalne)
7. [Wdrożenie na serwer (Ubuntu + Nginx + PHP-FPM)](#7-wdrożenie-na-serwer-ubuntu--nginx--php-fpm)
8. [Aktualizacja aplikacji na serwerze](#8-aktualizacja-aplikacji-na-serwerze)
9. [Jak działa frontend (`script.js`)](#9-jak-działa-frontend-scriptjs)
10. [Instrukcja obsługi panelu](#10-instrukcja-obsługi-panelu)
11. [Rozwiązywanie problemów](#11-rozwiązywanie-problemów)

---

## 0. Struktura projektu – co robi każdy plik

Projekt składa się z dwóch niezależnych części w osobnych folderach:

- **`backend/`** – "mózg" aplikacji (Laravel, PHP). Przechowuje dane w bazie PostgreSQL, pilnuje logowania i udostępnia dane przez API.
- **`frontend/`** – to, co użytkownik widzi w przeglądarce (strony, wygląd, przyciski). Frontend nie ma własnej bazy: pyta backend o dane i wysyła mu zmiany.

Jak to działa w skrócie: użytkownik klika coś na stronie → skrypt JS wysyła zapytanie do API → backend sprawdza, czy użytkownik jest zalogowany → pobiera lub zapisuje dane w bazie → odsyła odpowiedź → strona się odświeża.

### 0.1. Backend (`backend/`)

#### Kod aplikacji – `app/`

| Plik / folder | Za co odpowiada |
|---|---|
| `Http/Controllers/Api/UserDataController.php` | Obsługuje **użytkowników** książki telefonicznej: lista, dodawanie, edycja, usuwanie. |
| `Http/Controllers/Api/SectionController.php` | Obsługuje **działy** (np. IT, Księgowość): lista, dodawanie, usuwanie. |
| `Http/Controllers/AuthController.php` | **Logowanie i wylogowanie** administratora. |
| `Http/Controllers/Controller.php` | Bazowa klasa, po której dziedziczą pozostałe kontrolery. Zwykle pusta. |
| `Http/Middleware/` | "Strażnicy" żądań – sprawdzają np., czy ktoś jest zalogowany, zanim dostanie dane. |
| `Models/` | Opis tabel z bazy w kodzie PHP (np. użytkownik, dział), dzięki czemu nie trzeba pisać SQL ręcznie. |
| `Providers/` | Startowa konfiguracja aplikacji. Rzadko się go zmienia. |

#### Pozostałe foldery

| Folder | Za co odpowiada |
|---|---|
| `routes/` | **Mapa adresów API** – np. `/api/sections` trafia do `SectionController`. |
| `database/` | **Migracje** (przepisy na tworzenie tabel w PostgreSQL) i opcjonalnie dane startowe (seedery). |
| `config/` | Ustawienia Laravela (baza, sesje, cache itd.). Większość wartości czyta z `.env`. |
| `bootstrap/` | Uruchamianie frameworka i pliki cache. |
| `public/` | Jedyny folder dostępny z zewnątrz; zawiera `index.php` – punkt wejścia dla serwera WWW. |
| `storage/` | Logi (`storage/logs/laravel.log`), cache, sesje. Tu zagląda się, gdy coś nie działa. |
| `vendor/` | Biblioteki PHP pobrane przez Composer. Nie edytuje się ich i nie wrzuca do gita. |
| `node_modules/` | Biblioteki JS pobrane przez npm. Tak samo – nie edytuje się ich. |
| `.idea/` | Ustawienia edytora PhpStorm/IntelliJ. Nie wpływa na działanie aplikacji. |

#### Pliki w głównym folderze `backend/`

| Plik | Za co odpowiada |
|---|---|
| `.env` | **Ustawienia środowiska**: dane dostępu do bazy, tryb produkcyjny, klucz aplikacji. Zawiera hasła – pilnuj, kto go widzi. |
| `.env.example` | Wzór pliku `.env` (bez haseł) – punkt wyjścia przy nowej instalacji. |
| `composer.json` | Lista bibliotek PHP, których potrzebuje projekt, oraz wymagana wersja PHP. |
| `composer.lock` | Dokładne wersje bibliotek PHP, żeby każdy miał to samo. Generowany automatycznie. |
| `artisan` | Narzędzie wiersza poleceń Laravela (`php artisan migrate`, `php artisan serve` itd.). |
| `package.json` / `package-lock.json` | Lista i dokładne wersje bibliotek JS (narzędzia do budowania zasobów). |
| `vite.config.js` | Konfiguracja Vite, narzędzia do budowania zasobów JS/CSS. W tym projekcie frontend jest osobno, więc to głównie pozostałość po domyślnej instalacji Laravela. |
| `phpunit.xml` | Konfiguracja testów automatycznych. |
| `.editorconfig` | Wspólne zasady formatowania kodu (wcięcia, kodowanie) dla różnych edytorów. |
| `.gitignore` / `.gitattributes` | Co git ma pomijać (np. `vendor`, `.env`) i jak traktować pliki. |
| `README.md` | Ten opis projektu (może być też kopia w głównym folderze repozytorium). |
| `AGENTS.md`, `CLAUDE.md`, `boost.json`, `.mcp.json` | Pliki dla asystentów AI (instrukcje i konfiguracja narzędzi, np. Laravel Boost). Aplikacji nie dotyczą. |
| `.npmrc` | Ustawienia menedżera pakietów npm. |

### 0.2. Frontend (`frontend/`)

| Plik | Za co odpowiada |
|---|---|
| `admin-login.html` | **Strona logowania** administratora. Tu wraca użytkownik, gdy sesja wygaśnie. |
| `index.html` | **Główna strona panelu** – wyszukiwarka, formularze dodawania działu i użytkownika oraz tabele z danymi. |
| `script.js` | **Logika panelu** (szczegóły w sekcji 9): pobieranie danych z API, rysowanie tabel, wyszukiwanie, filtry, edycja, usuwanie, kontrola duplikatów. |
| `style.css` | **Wygląd panelu** (kolory, tabele, tryb ciemny, okna dialogowe). |
| `admin.html`, `admin.js`, `admin.css` | Zestaw odpowiedzialny za część administracyjną/logowanie (strona, jej skrypt i style). |
| `index.js`, `index.css` | Dodatkowy skrypt i style powiązane ze stroną główną. |
| `package.json` / `package-lock.json` | Lista i dokładne wersje bibliotek JS używanych przy pracy nad frontendem. |

> **Uwaga:** opis plików `admin.*`, `index.js` i `index.css` jest orientacyjny – sprawdź ich zawartość i popraw ten fragment, jeśli któryś pełni inną rolę (np. jeśli to pozostałości po starszej wersji i można je usunąć).

### 0.3. Pliki w głównym folderze repozytorium

| Plik | Za co odpowiada |
|---|---|
| `.gitignore` | Co git ma pomijać w całym repozytorium. |
| `package.json` / `package-lock.json` | Konfiguracja npm na poziomie całego projektu. |
| `readme.md` | Ten opis projektu. |

---

## 1. Wymagania

| Narzędzie | Wersja | Uwagi |
|---|---|---|
| PHP | zgodna z `composer.json` (sprawdź pole `require.php`) | rozszerzenia: `pdo_pgsql`, `pgsql`, `mbstring`, `xml`, `curl`, `zip`, `bcmath`, `intl` |
| Composer | 2.x | menedżer pakietów PHP |
| PostgreSQL | 14+ | najlepiej 15/16 |
| Git | dowolna | |
| Nginx + PHP-FPM | – | tylko na serwerze produkcyjnym |

Instalacja na Ubuntu / Debian:

```bash
sudo apt update
sudo apt install -y git unzip curl nginx postgresql postgresql-contrib \
  php-fpm php-cli php-pgsql php-mbstring php-xml php-curl php-zip php-bcmath php-intl

# Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

macOS (Homebrew):

```bash
brew install php composer postgresql@16 git
brew services start postgresql@16
```

---

## 2. Klonowanie repozytorium

```bash
git clone https://github.com/telebook-dev/telebook.git
cd telebook
```

Plik `.env` znajduje się w repozytorium, więc po sklonowaniu jest od razu dostępny. Trzeba w nim tylko ustawić dane bazy (krok 4).

---

## 3. Baza PostgreSQL

### 3.1. Utworzenie użytkownika i bazy

```bash
sudo -u postgres psql
```

W konsoli `psql`:

```sql
-- użytkownik aplikacji (zmień hasło!)
CREATE ROLE telebook_user WITH LOGIN PASSWORD 'ZMIEN_TO_HASLO';

-- baza z poprawnym kodowaniem, właścicielem jest użytkownik aplikacji
CREATE DATABASE telebook
    OWNER telebook_user
    ENCODING 'UTF8'
    LC_COLLATE 'pl_PL.UTF-8'
    LC_CTYPE 'pl_PL.UTF-8'
    TEMPLATE template0;

\q
```

> Jeśli polecenie zgłosi błąd o braku lokalizacji `pl_PL.UTF-8`, doinstaluj ją:
> `sudo locale-gen pl_PL.UTF-8 && sudo systemctl restart postgresql`
> albo utwórz bazę z `en_US.UTF-8` – aplikacja i tak sortuje działy po polsku po stronie przeglądarki (`localeCompare(..., "pl")`).

### 3.2. Uprawnienia (ważne od PostgreSQL 15)

Od wersji 15 zwykły użytkownik nie ma domyślnie prawa tworzenia tabel w schemacie `public`. Ponieważ użytkownik jest właścicielem bazy, zwykle wystarcza to, ale gdyby migracje zgłaszały `permission denied for schema public`:

```bash
sudo -u postgres psql -d telebook
```

```sql
ALTER SCHEMA public OWNER TO telebook_user;
GRANT ALL ON SCHEMA public TO telebook_user;
```

### 3.3. Sprawdzenie połączenia

```bash
psql -h 127.0.0.1 -U telebook_user -d telebook -c "SELECT version();"
```

Jeśli pojawia się `Peer authentication failed`, w `/etc/postgresql/<wersja>/main/pg_hba.conf` upewnij się, że dla połączeń `127.0.0.1/32` jest metoda `scram-sha-256` (lub `md5`), po czym:

```bash
sudo systemctl restart postgresql
```

### 3.4. Dobre praktyki

- Baza nasłuchuje tylko lokalnie (`listen_addresses = 'localhost'` w `postgresql.conf`), jeśli aplikacja stoi na tym samym serwerze.
- Regularne kopie zapasowe, np. codziennie z crona:

```bash
pg_dump -h 127.0.0.1 -U telebook_user -Fc telebook > /var/backups/telebook_$(date +%F).dump
```

- Odtwarzanie: `pg_restore -h 127.0.0.1 -U telebook_user -d telebook --clean /var/backups/telebook_RRRR-MM-DD.dump`

---

## 4. Konfiguracja Laravela (`.env`)

Otwórz `.env` i ustaw sekcję bazy danych:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=telebook
DB_USERNAME=telebook_user
DB_PASSWORD=ZMIEN_TO_HASLO
```

Na **produkcji** dodatkowo:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://telebook.twojafirma.pl
```

Jeśli w `.env` brakuje `APP_KEY` (puste pole), wygeneruj go (krok 5).

> Panel loguje się sesją opartą o cookie. Jeśli frontend i API stoją pod **tą samą domeną** (zalecane, patrz sekcja 7), nie trzeba nic więcej konfigurować. Jeśli są pod różnymi domenami / portami, ustaw w Laravelu CORS z `supports_credentials = true` oraz odpowiednie `SESSION_DOMAIN` (i `SANCTUM_STATEFUL_DOMAINS`, jeśli używasz Sanctum).

---

## 5. Instalacja pakietów i migracje

W katalogu projektu:

```bash
# 1. pakiety PHP
composer install

# 2. klucz aplikacji (tylko jeśli APP_KEY w .env jest pusty)
php artisan key:generate

# 3. migracje – tworzą tabele w bazie
php artisan migrate

# 4. (opcjonalnie) dane startowe, jeśli w projekcie są seedery
php artisan db:seed
```

Na produkcji używaj:

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
```

### Konto administratora

Panel wymaga zalogowania (`admin-login.html`). Jeżeli konto admina nie jest tworzone przez seeder, utwórz je przez Tinkera (dostosuj model i pola do swojego projektu):

```bash
php artisan tinker
```

```php
\App\Models\User::create([
    'name'     => 'Admin',
    'email'    => 'admin@firma.pl',
    'password' => bcrypt('MocneHaslo123!'),
]);
```

---

## 6. Uruchomienie lokalne

### Backend (API)

```bash
php artisan serve
# API dostępne pod http://localhost:8000/api
```

### Frontend

Frontend to statyczne pliki. Otwórz `index.html` przez prosty serwer (nie jako `file://`, bo cookie sesji tak nie zadziałają):

```bash
# w katalogu z plikami frontendu
python3 -m http.server 8000
# otwórz http://localhost:8000/admin-login.html
```

Adres API jest zapisany na górze `script.js`:

```js
const API = "http://localhost:8000/api";
```

Przy pracy lokalnej zostaw go tak, jak jest. Przy wdrożeniu zmień go (sekcja 7.5).

---

## 7. Wdrożenie na serwer (Ubuntu + Nginx + PHP-FPM)

Układ docelowy: jedna domena, Nginx serwuje pliki statyczne frontendu pod `/`, a wszystko pod `/api` przekazuje do Laravela. Dzięki temu cookie sesji działają bez dodatkowej konfiguracji CORS.

### 7.1. Pobranie kodu na serwer

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/telebook-dev/telebook.git
sudo chown -R $USER:www-data /var/www/telebook
cd /var/www/telebook
```

### 7.2. Pakiety, `.env`, migracje

Wykonaj kroki z sekcji 3, 4 i 5 (wersja produkcyjna: `--no-dev`, `migrate --force`, `APP_ENV=production`, `APP_DEBUG=false`).

### 7.3. Uprawnienia do katalogów Laravela

```bash
sudo chgrp -R www-data storage bootstrap/cache
sudo chmod -R ug+rwx storage bootstrap/cache
```

### 7.4. Cache produkcyjny

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

(Po każdej zmianie `.env` uruchom ponownie `php artisan config:cache`.)

### 7.5. Frontend – zmiana adresu API

W `script.js` zmień adres API na względny (ta sama domena):

```js
const API = "/api";
```

Pliki frontendu (`index.html`, `admin-login.html`, `style.css`, `admin.js`, `script.js`) muszą leżeć w katalogu serwowanym przez Nginx pod `/` (w przykładzie niżej: `/var/www/telebook-frontend`).

```bash
sudo mkdir -p /var/www/telebook-frontend
sudo cp index.html admin-login.html style.css admin.js script.js /var/www/telebook-frontend/
```

> Dostosuj listę plików do tego, co faktycznie leży w repozytorium (np. jeśli frontend ma własny podkatalog).

### 7.6. Konfiguracja Nginx

`/etc/nginx/sites-available/telebook`:

```nginx
server {
    listen 80;
    server_name telebook.twojafirma.pl;

    # --- frontend (pliki statyczne) ---
    root /var/www/telebook-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # --- API Laravel ---
    location /api {
        root /var/www/telebook/public;
        try_files $uri /index.php?$query_string;
    }

    # skrypt wejściowy Laravela (dostosuj wersję PHP-FPM)
    location = /index.php {
        root /var/www/telebook/public;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/telebook/public/index.php;
    }

    # Laravel potrzebuje też tras sesji/CSRF, jeśli używasz Sanctum:
    # location /sanctum { ... }  (analogicznie do /api)

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Włączenie konfiguracji:

```bash
sudo ln -s /etc/nginx/sites-available/telebook /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Sprawdź wersję PHP-FPM (`php -v`, `ls /run/php/`) i popraw ścieżkę gniazda `php8.3-fpm.sock`, jeśli masz inną wersję.

### 7.7. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d telebook.twojafirma.pl
```

Po włączeniu HTTPS ustaw w `.env`:

```dotenv
APP_URL=https://telebook.twojafirma.pl
SESSION_SECURE_COOKIE=true
```

i wykonaj `php artisan config:cache`.

### 7.8. Test

- `https://telebook.twojafirma.pl/admin-login.html` – strona logowania
- `https://telebook.twojafirma.pl/api/sections` – bez logowania powinno zwrócić `401`, po zalogowaniu listę działów

---

## 8. Aktualizacja aplikacji na serwerze

```bash
cd /var/www/telebook
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
sudo systemctl reload php8.3-fpm
```

Jeśli zmienił się frontend, skopiuj ponownie pliki statyczne do `/var/www/telebook-frontend/` (pamiętając o `const API = "/api";`).

---

## 9. Jak działa frontend (`script.js`)

Skrypt ładowany jest na końcu `<body>`, więc wszystkie elementy już istnieją. Na starcie wywoływane są kolejno: `initTheme`, `initPanelToggles`, `initSearch`, `initTableActions`, `initUserForm`, `initSectionForm`, `initEditForm` oraz `refreshData()`.

### 9.1. Konfiguracja

- `API` – adres backendu.
- `UNASSIGNED` – nazwa grupy dla użytkowników bez działu („Brak działu”).
- `COLUMNS`, `COLUMN_WIDTHS`, `ACTIONS_WIDTH` – kolejność i szerokości kolumn tabeli (razem z kolumną „Akcje” dają 100%).
- `STORAGE` – klucze `localStorage` (motyw, widoczność paneli).

### 9.2. Komunikacja z API

Funkcja `api(path, options)` opakowuje `fetch`:

- dokleja prefiks `API` i wysyła cookie sesji (`credentials: "include"`),
- ustawia nagłówki `Accept: application/json` i `Content-Type` (gdy jest body),
- na odpowiedź **401** przekierowuje na `admin-login.html`,
- przy innym błędzie rzuca wyjątek z czytelnym komunikatem (błędy walidacji Laravela `errors` są łączone w jedną wiadomość),
- dla `204` zwraca `null`.

Używane endpointy: `GET /userdata`, `POST /userdata`, `PUT /userdata/{id}`, `DELETE /userdata/{id}`, `GET /sections`, `POST /sections`, `DELETE /sections/{id}`. Funkcja `unwrap` akceptuje odpowiedź w formie tablicy albo `{ data: [...] }`.

### 9.3. Ładowanie i renderowanie danych

1. `refreshData()` pobiera **równolegle** użytkowników i działy (`Promise.all`).
2. Licznik `refreshToken` chroni przed „wyścigiem”: jeśli w trakcie pobierania ruszyło nowsze odświeżenie, starszy wynik jest ignorowany.
3. Dane lądują w obiekcie `state` (`users`, `sections`).
4. `populateSectionSelect()` wypełnia listę działów w formularzu dodawania.
5. `renderGroups()` grupuje użytkowników po dziale, sortuje działy alfabetycznie po polsku i generuje HTML tabel (`groupHTML`, `rowHTML`).
6. Przed przebudową tabel zapamiętywane są wartości filtrów kolumn (`captureFilters`) i pozycja przewijania, a po niej przywracane (`restoreFilters`, `scrollTo`).
7. Gdy pobranie się nie uda: przy pierwszym ładowaniu pokazuje się komunikat z przyciskiem „Spróbuj ponownie”, a przy kolejnych odświeżeniach – powiadomienie (toast).

Każda wartość wstawiana do `innerHTML` przechodzi przez `escapeHtml()`, co chroni przed XSS.

W komórkach:

- telefon jest linkiem `tel:`,
- e-mail jest linkiem `mailto:` (kilka adresów rozdzielonych spacją wyświetla się w osobnych liniach),
- **IP jest linkiem `anydesk:IP`** – kliknięcie uruchamia lokalną aplikację AnyDesk i łączy się z danym komputerem (wymaga zainstalowanego AnyDesk na komputerze osoby, która klika).

### 9.4. Wyszukiwanie i filtrowanie

Są dwa mechanizmy, które działają razem (warunek AND):

**Wyszukiwarka globalna** (pole na górze strony) – przeszukuje wszystkie działy naraz.

**Filtry kolumn** (drugi wiersz nagłówka każdej tabeli) – działają osobno w każdej tabeli i osobno dla każdej kolumny.

Jak to liczy skrypt:

1. **Normalizacja** (`normalize`) – tekst jest zamieniany na małe litery, usuwane są spacje na brzegach oraz znaki diakrytyczne (ą→a, ę→e, ś→s, ł→l itd.). Dzięki temu wpisanie `lukasz` znajdzie „Łukasz”, a `krakow` znajdzie „Kraków”.
2. **Słowa** (`splitWords`) – to, co wpisano, jest dzielone na słowa po spacjach.
3. **Wyszukiwarka globalna** – wiersz pasuje, jeśli **każde** wpisane słowo występuje gdziekolwiek w tekście wiersza (wszystkie komórki **plus nazwa działu**). Kolejność słów nie ma znaczenia: `kowalski it` znajdzie Kowalskiego z działu IT.
4. **Filtry kolumn** (`rowMatches`):
    - kolumna **Id** – dokładne dopasowanie (wpisanie `1` nie pokaże id 10, 11…),
    - pozostałe kolumny – każde wpisane słowo musi występować w tej kolumnie.
5. **Wynik** (`filterGroup`) – niepasujące wiersze są ukrywane (`hidden`), pasujące przy aktywnej wyszukiwarce dostają klasę `search-match` (podświetlenie). Jeśli tabela jest pusta lub nic nie pasuje, pokazuje się wiersz z komunikatem („Ten dział nie ma jeszcze użytkowników” / „Brak wyników dla wybranych filtrów”).
6. **Ukrywanie działów** – gdy działa wyszukiwarka globalna i dział nie ma pasujących wierszy, cały dział jest ukrywany (chyba że ma aktywne filtry kolumn).
7. **Licznik** (`updateInfo`) pod wyszukiwarką pokazuje np. „Widocznych użytkowników: 42” albo „Znaleziono 3 użytkowników w 2 działach” (z poprawną polską odmianą).
8. **Wydajność** – znormalizowany tekst komórek jest liczony raz i zapamiętywany na elemencie wiersza (`row._cells`). Nasłuchiwanie na filtry jest ustawione **jeden raz** na kontenerze (delegacja zdarzeń), więc działa też po przebudowie tabel.
9. Przycisk **Wyczyść** zeruje wyszukiwarkę i wszystkie filtry kolumn.

### 9.5. Akcje w tabelach

Jeden nasłuch kliknięć na kontenerze obsługuje przyciski po atrybucie `data-action`:

- `edit-user` – otwiera okno edycji,
- `delete-user` – pyta o potwierdzenie i usuwa użytkownika,
- `delete-section` – usuwa dział (przycisk „Usuń dział” pojawia się tylko dla **pustych** działów, które istnieją w bazie),
- `retry` – ponawia pobieranie danych po błędzie.

Po każdej zmianie wywoływane jest `refreshData()`, a użytkownik dostaje powiadomienie (toast): zielone dla sukcesu, czerwone (dłużej widoczne) dla błędu.

### 9.6. Formularze

**Dodawanie działu** – sprawdza, czy dział o takiej nazwie już istnieje (bez rozróżniania wielkości liter), wysyła `POST /sections` i od razu zaznacza nowy dział na liście w formularzu użytkownika.

**Dodawanie użytkownika** – zbiera pola (dział, oznaczenie, imię, nazwisko, e-mail, telefon, pokój, IP) i wysyła `POST /userdata`. Przed wysłaniem `findDuplicates()` sprawdza, czy taki e-mail, IP lub telefon nie jest już przypisany do kogoś innego. Jeśli tak, pokazuje okno „Możliwy duplikat” z opcją „Dodaj mimo to”. Po sukcesie formularz jest czyszczony, **dział zostaje wybrany**, a kursor wraca na pole telefonu – to ułatwia szybkie wpisywanie wielu osób z jednego działu.

**Edycja** – to samo okno i te same kontrole duplikatów, ale z pominięciem edytowanego użytkownika (`ignoreId`). Wysyła `PUT /userdata/{id}`.

Pole IP w formularzach ma wzorzec (`pattern`) wymuszający poprawny adres IPv4.

### 9.7. Motyw i interfejs

- **Tryb ciemny** – zapamiętywany w `localStorage`; dopóki użytkownik sam nie wybierze motywu, aplikacja podąża za ustawieniem systemu. Krótki skrypt w `<head>` ustawia motyw przed pierwszym renderem, żeby nie było błysku jasnego tła. Płynne przejście kolorów jest wyłączane, jeśli system ma włączone „ograniczenie ruchu”.
- **Przełączniki paneli** – panele „Dodaj dział” i „Dodaj użytkownika” można ukryć; wybór jest zapamiętywany.
- **Okno potwierdzenia** (`confirmDialog`) zastępuje systemowe `confirm()`, a **toasty** zastępują `alert()`.

---

## 10. Instrukcja obsługi panelu

1. **Logowanie** – wejdź na `admin-login.html` i zaloguj się kontem administratora. Po wygaśnięciu sesji zostaniesz automatycznie przeniesiony z powrotem do logowania.
2. **Dodanie działu** – wpisz nazwę w panelu „Dodaj dział” i kliknij **+**.
3. **Dodanie użytkownika** – wybierz dział, uzupełnij dane i kliknij „Dodaj użytkownika”. Pole Id nadaje się automatycznie. Jeśli aplikacja ostrzeże o duplikacie, zdecyduj, czy dodać mimo to.
4. **Szukanie** – wpisz w górne pole imię, nazwisko, numer, pokój, dział itp. (można kilka słów naraz, bez polskich znaków). Pod polem widać, ile osób znaleziono.
5. **Filtrowanie kolumn** – wpisz tekst w pole „Filtruj” pod nagłówkiem wybranej kolumny w tabeli danego działu. Filtry można łączyć z wyszukiwarką globalną.
6. **Czyszczenie** – przycisk „Wyczyść” resetuje wszystko.
7. **Edycja / usuwanie** – przyciski **Edit** i **Delete** w kolumnie „Akcje”. Usuwanie wymaga potwierdzenia.
8. **Usuwanie działu** – możliwe tylko wtedy, gdy dział jest pusty (przycisk „Usuń dział”).
9. **Łączenie z komputerem** – kliknij adres IP w tabeli; uruchomi się AnyDesk (musi być zainstalowany lokalnie).
10. **Tryb ciemny i panele** – przełączniki w nagłówku.

---

## 11. Rozwiązywanie problemów

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| `could not find driver` przy migracji | brak `php-pgsql` – `sudo apt install php-pgsql`, restart PHP-FPM |
| `SQLSTATE[08006] connection refused` | PostgreSQL nie działa lub złe `DB_HOST` / `DB_PORT` w `.env` |
| `password authentication failed` | zły `DB_USERNAME` / `DB_PASSWORD` albo `pg_hba.conf` |
| `permission denied for schema public` | patrz sekcja 3.2 |
| `No application encryption key` | `php artisan key:generate`, potem `php artisan config:cache` |
| 500 po wdrożeniu | prawa do `storage/` i `bootstrap/cache/` (sekcja 7.3), logi: `storage/logs/laravel.log` |
| 404 na `/api/...` | zła konfiguracja Nginx (sekcja 7.6) lub nieodświeżony `route:cache` |
| Panel w kółko wraca do logowania | cookie sesji nie dochodzi: sprawdź, czy frontend i API są pod tą samą domeną, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE` (HTTPS) i CORS (`supports_credentials`) |
| „brak połączenia z serwerem” w panelu | zły adres w `const API` w `script.js` albo API nie działa |
| Zmiany w `.env` nie działają | `php artisan config:clear` lub ponownie `config:cache` |
| Link IP nic nie robi | AnyDesk nie jest zainstalowany na komputerze klikającego albo przeglądarka blokuje protokół `anydesk:` |