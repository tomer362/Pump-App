import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/session";
import {
  IMAGE_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  uploadsEnabled,
} from "@/lib/blob";

/**
 * Client-upload token endpoint.
 *
 * The browser sends the bytes straight to Blob storage rather than through a
 * server action: a serverless function has a small request body limit and a
 * ~30 s ceiling, and proxying a photo from a phone on gym wifi would spend
 * both plus the bandwidth allowance for nothing.
 *
 * The token is minted here, so this is the authorisation point: signed-in
 * only, image content types only, and a size cap enforced by Blob itself.
 */
export async function POST(request: Request) {
  if (!uploadsEnabled()) {
    return Response.json({ error: "Uploads are not configured" }, { status: 501 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const me = await getCurrentUser();
        if (!me) throw new Error("Not signed in");
        return {
          allowedContentTypes: [...IMAGE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          // Random suffix: without it a second upload to the same pathname
          // would overwrite the first, and pathnames are caller-supplied.
          addRandomSuffix: true,
          // Carried back on completion so a leaked token can't attribute an
          // upload to somebody else.
          tokenPayload: JSON.stringify({ userId: me.id }),
        };
      },
      onUploadCompleted: async () => {
        // Intentionally empty. This fires as a webhook from Blob and never
        // reaches a localhost dev server, so nothing may depend on it — the
        // client persists the returned URL through a server action instead.
      },
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
