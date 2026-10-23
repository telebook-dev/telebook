<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SectionOrderController extends Controller
{
    private const FILE = 'section_order.json';

    public function show()
    {
        if (!Storage::disk('local')->exists(self::FILE)) {
            return response()->json([]);
        }

        $order = json_decode(Storage::disk('local')->get(self::FILE), true);

        return response()->json(is_array($order) ? array_values($order) : []);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'order'   => ['required', 'array'],
            'order.*' => ['integer'],
        ]);

        // unikalne ID, w podanej kolejności
        $order = array_values(array_unique($data['order']));

        Storage::disk('local')->put(self::FILE, json_encode($order));

        return response()->json(['order' => $order]);
    }
}