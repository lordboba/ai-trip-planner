function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function placeholderHtml(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f5f1ee, #fff5f0);
        color: #3d3632;
        font: 600 14px/1.5 Sora, system-ui, sans-serif;
      }
      div {
        max-width: 20rem;
        padding: 1rem 1.25rem;
        border-radius: 18px;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(232,227,223,0.9);
        text-align: center;
        box-shadow: 0 14px 40px rgba(61,54,50,0.08);
      }
      span {
        display: block;
        margin-top: 0.4rem;
        font-size: 12px;
        font-weight: 500;
        color: #8a7f79;
      }
    </style>
  </head>
  <body>
    <div>${escapeHtml(message)}<span>Add a Google Maps key to render the live map.</span></div>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = searchParams.get("placeId")?.trim();
  const query = searchParams.get("query")?.trim();

  if (!apiKey) {
    return new Response(placeholderHtml("Map preview is running in fallback mode."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!placeId && !query) {
    return new Response(placeholderHtml("Choose a destination to load the map preview."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const q = placeId ? `place_id:${placeId}` : query!;
  const embedUrl = new URL("https://www.google.com/maps/embed/v1/place");
  embedUrl.searchParams.set("key", apiKey);
  embedUrl.searchParams.set("q", q);

  return Response.redirect(embedUrl.toString(), 302);
}
