<?php

namespace App\Http\Controllers\Api;

use App\Models\UserData;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserDataController extends Controller
{
    public function index()
    {
        return UserData::with(['section', 'details'])->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'section_id'   => 'required|exists:sections,id',
            'designation'  => 'nullable|string|max:255',
            'name'         => 'nullable|string|max:255',
            'last_name'    => 'nullable|string|max:255',
            'email'        => 'nullable|string|max:255',
            'phone_number' => 'nullable|string|max:60',
            'room_number'  => 'nullable|string|max:50',
            'ip_number'    => 'nullable|string|max:45',
        ]);

        $user = UserData::create([
            'section_id'   => $data['section_id'],
            'designation'  => $data['designation'] ?? null,
            'name'         => $data['name'],
            'last_name'    => $data['last_name'],
            'email'        => $data['email'],
            'phone_number' => $data['phone_number'] ?? null,
        ]);

        $user->details()->create([
            'room_number' => $data['room_number'] ?? null,
            'ip_number'   => $data['ip_number'] ?? null,
        ]);

        return response()->json($user->load(['section', 'details']), 201);
    }

    public function update(Request $request, $id)
    {
        $user = UserData::findOrFail($id);

        $data = $request->validate([
            'section_id'   => 'required|exists:sections,id',
            'designation'  => 'nullable|string|max:255',
            'name'         => 'nullable|string|max:255',
            'last_name'    => 'nullable|string|max:255',
            'email'        => [
                'nullable',
                'string',
                Rule::unique('userdata', 'email')->ignore($user->id),
            ],
            'phone_number' => 'nullable|string|max:60',
            'room_number'  => 'nullable|string|max:50',
            'ip_number'    => 'nullable|string|max:45',
        ]);

        DB::transaction(function () use ($user, $data) {
            $user->update([
                'section_id'   => $data['section_id'],
                'designation'  => $data['designation'] ?? null,
                'name'         => $data['name'],
                'last_name'    => $data['last_name'],
                'email'        => $data['email'],
                'phone_number' => $data['phone_number'] ?? null,
            ]);

            // hasOne: klucz obcy jest dopisywany automatycznie;
            // tworzy rekord details, jeśli użytkownik go jeszcze nie ma
            $user->details()->updateOrCreate([], [
                'room_number' => $data['room_number'] ?? null,
                'ip_number'   => $data['ip_number'] ?? null,
            ]);
        });

        return response()->json($user->load(['section', 'details']));
    }

    public function destroy($id)
    {
        $user = UserData::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'Użytkownik został usunięty'
        ]);
    }
}
