<?php

use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\UserDataController;
use Illuminate\Support\Facades\Route;

Route::get('/userdata', [UserDataController::class, 'index']);
Route::post('/userdata', [UserDataController::class, 'store']);
Route::delete('/userdata/{id}', [UserDataController::class, 'destroy']);

Route::post('/sections', [SectionController::class, 'store']);
