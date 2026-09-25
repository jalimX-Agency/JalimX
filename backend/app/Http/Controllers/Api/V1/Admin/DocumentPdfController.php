<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Support\DocumentPdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * The document as paper, opened from the dashboard. The rendering itself
 * lives in DocumentPdf, shared with sending it on WhatsApp.
 */
class DocumentPdfController extends Controller
{
    public function __invoke(Document $document): Response
    {
        // Checked here rather than by middleware: see the note on the route.
        abort_unless(Auth::guard('web')->check(), 403);

        // Inline: the dashboard opens this in a tab to check it before it is
        // sent, and a download that must then be found in a folder is worse.
        return DocumentPdf::render($document)->stream(DocumentPdf::filename($document));
    }
}
