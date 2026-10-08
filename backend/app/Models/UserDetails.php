<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserDetails extends Model
{
    protected $table = 'userdetails';

    protected $fillable = [
        'user_data_id',
        'room_number',
        'ip_number',
    ];
    public function userData()
    {
        return $this->belongsTo(UserData::class, 'user_data_id');
    }
}
