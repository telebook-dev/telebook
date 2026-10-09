<?php

use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\UserDataController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Tutaj rejestrujesz trasy API dla swojej aplikacji. Trasy te
| są automatycznie przypisywane do grupy "api" przez ServiceProvider.
|
*/

// ==========================================
// 1. TRASY PUBLICZNE (Dostępne dla każdego)
// ==========================================

// Logowanie administratora (zwraca ciasteczko HttpOnly z tokenem)
Route::post('/login', [AuthController::class, 'login']);


// ==========================================
// 2. TRASY CHRONIONE (Wymagają poprawnego ciasteczka admin_token)
// ==========================================

Route::middleware('auth.admin')->group(function () {

    // Zarządzanie użytkownikami (Wyświetlanie, Dodawanie, Usuwanie)
    Route::get('/userdata', [UserDataController::class, 'index']);
    Route::post('/userdata', [UserDataController::class, 'store']);
    Route::delete('/userdata/{id}', [UserDataController::class, 'destroy']);

    // Zarządzanie sekcjami
    Route::post('/sections', [SectionController::class, 'store']);

    // Endpoint testowy sprawdzający, czy sesja/token jest nadal ważny
    Route::get('/admin-data', function () {
        return response()->json([
            'success' => true,
            'message' => 'Dostęp przyznany'
        ]);
    });

    // Wylogowanie (Usuwa plik hasha i czyści ciasteczko po stronie serwera)
    Route::post('/logout', [AuthController::class, 'logout']);
});
