<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Engagement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Paperwork kept against a piece of work.
 *
 * The stored path has nothing to do with the filename: it is random, in a
 * bucket with no public URL, and the only way back out is the download
 * route below, which runs behind the session. The name the person sees is
 * the name they uploaded; the name in the bucket is noise.
 */
class AttachmentController extends Controller
{
    public function store(Request $request, Engagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(Attachment::KINDS)],
            /*
             * A deliberately short list of types, checked by content. No
             * archives and nothing executable: this is a drawer for
             * paperwork, not a file host.
             */
            'file' => [
                'required', 'file', 'max:20480',
                'mimes:pdf,doc,docx,xls,xlsx,csv,txt,jpg,jpeg,png,webp,avif,heic',
            ],
        ]);

        $file = $data['file'];
        $extension = $file->extension() ?: 'bin';
        $path = sprintf('engagements/%d/%s.%s', $engagement->id, Str::random(40), $extension);

        Storage::disk('files')->put($path, $file->get(), ['visibility' => 'private']);

        $attachment = $engagement->attachments()->create([
            'kind' => $data['kind'],
            // Trimmed to something a filesystem will accept back, and kept
            // as a label only - it never becomes part of a path.
            'name' => Str::limit($file->getClientOriginalName(), 180, ''),
            'path' => $path,
            'disk' => 'files',
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);

        return response()->json(['data' => $this->shape($attachment)], 201);
    }

    /**
     * Streamed, so a 20 MB contract never sits in the app's memory.
     *
     * Reached from the web routes, where the session is checked by hand:
     * a link opened in a new tab sends no Origin, and Sanctum reads that
     * as a request with no credentials at all.
     */
    public function download(Attachment $attachment): StreamedResponse
    {
        abort_unless(Auth::guard('web')->check(), 403);

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->name,
        );
    }

    public function destroy(Attachment $attachment): JsonResponse
    {
        $attachment->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function shape(Attachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'engagement_id' => $attachment->engagement_id,
            'kind' => (string) $attachment->kind,
            'name' => (string) $attachment->name,
            'mime' => $attachment->mime,
            'size' => (int) $attachment->size,
            'created_at' => $attachment->created_at?->toIso8601String(),
        ];
    }
}
