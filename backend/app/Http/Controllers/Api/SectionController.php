<?php

namespace App\Http\Controllers\Api;

use App\Models\Section;
use Illuminate\Http\Request;

class SectionController
{
    public function store(Request $request)
    {
        $section = Section::create([
            'designation' => $request->designation,
            'department' => $request->department,
        ]);
        return $section;
    }
}
