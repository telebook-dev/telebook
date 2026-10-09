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
        $user = UserData::create([
            'section_id' => $request->section_id,
            'name' => $request->name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'phone_number' => $request->phone_number,
        ]);

        $user->details()->create([
            'room_number' => $request->room_number,
            'ip_number' => $request->ip_number,
        ]);
        return $user->load('section', 'details');
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
