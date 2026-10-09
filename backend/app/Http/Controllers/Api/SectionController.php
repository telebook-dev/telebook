<?php

namespace App\Http\Controllers\Api;

use App\Models\Section;
use Illuminate\Http\Request;

class SectionController
{
    public function index()
    {
        return Section::orderBy('department')->get(['id', 'department']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'department' => 'required|string|max:255|unique:sections,department',
        ]);

        $section = Section::create($data);

        return response()->json($section, 201);
    }
    public function destroy($id)
{
    $section = Section::withCount('users')->findOrFail($id);

    if ($section->users_count > 0) {
        return response()->json([
            'message' => 'Nie można usunąć działu, który zawiera użytkowników.'
        ], 409);
    }

    $section->delete();

    return response()->json(['message' => 'Dział został usunięty']);
}
}