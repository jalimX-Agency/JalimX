<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Engagement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * Paperwork kept against a piece of work.
 *
 * These files share the bucket the site's images live in, and that bucket
 * is served publicly — so the file is encrypted before it is written. What
 * sits in the bucket is ciphertext under a random 40-character name: a
 * guessed or leaked address gives someone a blob they cannot read, which
 * is the difference between an address leak and a contract leak. The
 * plaintext exists only inside a response to a signed-in request here.
 *
 * The cost is honest: the whole file passes through the application on the
 * way in and out, which is fine at 20 MB and would not be at 200. Point
 * R2_FILES_BUCKET at a bucket with no public access when there is one, and
 * this stops being the only thing standing between a URL and a contract.
 */
class AttachmentController extends Controller
{
    /**
     * The types a browser can show without being asked to run anything.
     *
     * Everything else downloads. HTML and SVG are deliberately absent:
     * shown inline they run script on this origin, which is the origin
     * that holds the session.
     */
    private const VIEWABLE = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
    ];

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
        $path = sprintf('engagements/%d/%s.enc', $engagement->id, Str::random(40));

        Storage::disk('files')->put($path, Crypt::encryptString($file->get()));

        $attachment = $engagement->attachments()->create([
            'kind' => $data['kind'],
            // Trimmed to something a filesystem will accept back, and kept
            // as a label only - it never becomes part of a path.
            'name' => Str::limit($file->getClientOriginalName(), 180, ''),
            'path' => $path,
            'disk' => 'files',
            // The detected type, not the one the browser claimed: what a
            // file actually is decides how it is served back.
            'mime' => $file->getMimeType() ?: $file->getClientMimeType(),
            // The real size, not the ciphertext's: this is what the person
            // uploaded and what they will get back.
            'size' => $file->getSize(),
        ]);

        return response()->json(['data' => $this->shape($attachment)], 201);
    }

    /**
     * Saved to disk.
     *
     * On the web routes, where the session is checked by hand: a link
     * opened in a new tab sends no Origin, and Sanctum reads that as a
     * request with no credentials at all.
     */
    public function download(Attachment $attachment): Response
    {
        abort_unless(Auth::guard('web')->check(), 403);

        return $this->serve($attachment, 'attachment', 'application/octet-stream');
    }

    /**
     * The same file, shown rather than saved: a contract opens in a tab
     * next to the dashboard instead of landing in a downloads folder.
     *
     * Only for the types above. Anything else is handed over as a
     * download, because "preview" of a Word file means asking the browser
     * to guess, and guessing is how a file becomes a page.
     */
    public function preview(Attachment $attachment): Response
    {
        abort_unless(Auth::guard('web')->check(), 403);

        $mime = (string) $attachment->mime;

        if (! in_array($mime, self::VIEWABLE, true)) {
            return $this->download($attachment);
        }

        return $this->serve($attachment, 'inline', $mime);
    }

    public function destroy(Attachment $attachment): JsonResponse
    {
        $attachment->delete();

        return response()->json(null, 204);
    }

    /** Decrypts and hands over, with the headers that keep it inert. */
    private function serve(Attachment $attachment, string $disposition, string $mime): Response
    {
        try {
            $stored = Storage::disk($attachment->disk)->get($attachment->path);
        } catch (Throwable) {
            // The row outlived its file: a 404 is the honest answer, and a
            // stack trace about a bucket is not.
            $stored = null;
        }

        abort_if($stored === null, 404);

        return response(Crypt::decryptString($stored), 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition.'; filename="'.str_replace('"', '', $attachment->name).'"',
            // No sniffing, no framing, no cache on disk: the file is
            // private, and a browser that second-guesses its type is the
            // one way an image becomes a script.
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; object-src 'self'",
            'Cache-Control' => 'private, no-store',
        ]);
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
            // Whether it can be opened in a tab, or only saved.
            'viewable' => in_array((string) $attachment->mime, self::VIEWABLE, true),
            'created_at' => $attachment->created_at?->toIso8601String(),
        ];
    }
}
