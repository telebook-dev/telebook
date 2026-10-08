<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    protected $fillable =
        [
            'designation',
            'department',
        ];
    public function users()
    {
        return $this->hasMany(UserData::class,'section_id');
    }
}
