<?php

use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\UserDataController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

// ==========================================
// 1. TRASY PUBLICZNE
// ==========================================

// Logowanie administratora
Route::post('/login', [AuthController::class, 'login']);
Route::get('/userdata', [UserDataController::class, 'index']);
Route::get('/sections', [SectionController::class, 'index']);
// ==========================================
// 2. TRASY CHRONIONE — ADMIN
// ==========================================

Route::middleware('auth.admin')->group(function () {

    // Zarządzanie użytkownikami

    Route::post('/userdata', [UserDataController::class, 'store']);
    Route::delete('/userdata/{id}', [UserDataController::class, 'destroy']);

    // Zarządzanie sekcjami

    Route::post('/sections', [SectionController::class, 'store']);
    Route::delete('/sections/{id}', [SectionController::class, 'destroy']);
    Route::put('/userdata/{id}', [UserDataController::class, 'update']);

    // Sprawdzanie sesji administratora
    Route::get('/admin-data', function () {
        return response()->json([
            'success' => true,
            'message' => 'Dostęp przyznany',
        ]);
    });

    // Wylogowanie administratora
    Route::post('/logout', [AuthController::class, 'logout']);
});
