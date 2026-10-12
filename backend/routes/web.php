<?php

use Illuminate\Support\Facades\Route;

Route::get('/admin-panel', function () {
    $file = base_path('../frontend/admin.html');

    abort_unless(file_exists($file), 404);

    return response()->file($file, [
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma' => 'no-cache',
    ]);
})->middleware('auth.admin');
