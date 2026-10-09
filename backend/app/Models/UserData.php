<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserData extends Model
{
    protected $table = 'userdata';

    protected $fillable =
        [
            'section_id',
            'designation',
            'name',
            'last_name',
            'email',
            'phone_number',
        ];
    public function section()
    {
        return $this->belongsTo(Section::class, 'section_id');
    }
    public function details()
    {
        return $this->hasOne(UserDetails::class, 'user_data_id');
    }
}
