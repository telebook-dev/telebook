const API_URL = 'http://10.10.1.5:8000/api';

// ========================================
// SPRAWDZANIE DOSTĘPU W PANELU (admin.html)
// ========================================

async function checkAdminAccess() {
    const isLoginPage = window.location.pathname.includes('admin-login.html') || document.querySelector('.login-form');
    if (isLoginPage) return;

    try {
        const response = await fetch(`${API_URL}/admin-data`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.replace('admin-login.html');
            return;
        }

        // dostęp potwierdzony – pokaż stronę
        document.documentElement.classList.remove('auth-pending');
    } catch (error) {
        console.error('Błąd sprawdzania dostępu:', error);
        window.location.replace('admin-login.html');
    }
}

// uruchom od razu przy ładowaniu (skrypt jest na końcu <body>)
checkAdminAccess();

// po powrocie przyciskiem „wstecz” (cache strony) sprawdź ponownie
window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkAdminAccess();
});

// ========================================
// LOGOWANIE (na stronie admin-login.html)
// ========================================

const loginForm = document.querySelector('.login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const username = document.querySelector('#username').value.trim();
        const password = document.querySelector('#password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include', // KLUCZOWE: pozwala zapisać ciasteczko HttpOnly od serwera
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Nie zapisujemy już tokena w localStorage!
                // Ciasteczko HttpOnly zostało bezpiecznie zapisane przez przeglądarkę.

                // Przekierowanie na główny panel (admin.html)
                window.location.href = 'admin.html';
            } else {
                alert(data.message || 'Nieprawidłowy login lub hasło');
            }
        } catch (error) {
            console.error('Błąd logowania:', error);
            alert('Nie udało się połączyć z serwerem.');
        }
    });
}

// ========================================
// WYLOGOWANIE
// ========================================

async function logout() {
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
    } catch (error) {
        console.error('Błąd wylogowania:', error);
    } finally {
        // Niezależnie od odpowiedzi serwera, wyrzucamy na logowanie
        window.location.replace('admin-login.html');
    }
}

window.logout = logout;

// ========================================
// URUCHOMIENIE SPRAWDZANIA PRZY ŁADOWANIU
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});