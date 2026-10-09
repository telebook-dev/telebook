<?php

namespace App\Http\Controllers\Api;

use App\Models\UserData;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

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
            'name'         => 'required|string|max:255',
            'last_name'    => 'required|string|max:255',
            'email' => 'required|email|unique:userdata,email',
            'phone_number' => 'nullable|string|max:20',
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

    public function destroy($id)
    {
        $user = UserData::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'Użytkownik został usunięty'
        ]);
    }
}