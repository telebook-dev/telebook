<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\Response;

class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        // Pobieramy token bezpośrednio z bezpiecznego ciasteczka HttpOnly
        $token = $request->cookie('admin_token');
        $path = storage_path('app/private/admin-token.hash');

        if (
            !$token ||
            !is_file($path) ||
            !hash_equals(
                trim(File::get($path)),
                hash('sha256', $token)
            )
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Brak dostępu. Zaloguj się ponownie.'
            ], 401);
        }

        return $next($request);
    }
}
