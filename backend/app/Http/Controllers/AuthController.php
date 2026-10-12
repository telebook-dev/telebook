<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $adminUsername = (string) env('ADMIN_USERNAME');
        $adminPassword = (string) env('ADMIN_PASSWORD');

        if (
            !hash_equals($adminUsername, $credentials['username']) ||
            !hash_equals($adminPassword, $credentials['password'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Nieprawidłowy login lub hasło',
            ], 401);
        }

        $token = bin2hex(random_bytes(32));
        $path = storage_path('app/private/admin-token.hash');

        File::ensureDirectoryExists(dirname($path));
        File::put($path, hash('sha256', $token));

        // Zwracamy ciasteczko HttpOnly
        return response()->json([
            'success' => true,
            'message' => 'Zalogowano pomyślnie',
        ])->cookie(
            'admin_token',
            $token,
            120, // wygasa za 120 minut
            '/',
            null,
            app()->isProduction(), // Secure true na produkcji (HTTPS)
            true, // HttpOnly - blokuje dostęp z JS
            false,
            'lax'
        );
    }

    public function logout(Request $request)
    {
        // 1. Usuwamy plik hasha z serwera, żeby stary token natychmiast przestał być ważny
        $path = storage_path('app/private/admin-token.hash');
        if (File::exists($path)) {
            File::delete($path);
        }

        // 2. Zwracamy odpowiedź z ciasteczkiem o ujemnym czasie życia (usuwa je z przeglądarki)
        return response()->json([
            'success' => true,
            'message' => 'Wylogowano pomyślnie',
        ])->cookie(
            'admin_token',
            '',
            -1, // Czas ujemny natychmiast kasuje ciasteczko w przeglądarce
            '/',
            null,
            app()->isProduction(),
            true,
            false,
            'lax'
        );
    }
}
