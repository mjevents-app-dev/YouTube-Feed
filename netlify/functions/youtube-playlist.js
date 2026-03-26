const ALLOWED_ORIGINS = [
  "https://mjeventsrental.com",
  "https://www.mjeventsrental.com",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
];

function getCorsHeaders(origin = "") {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://mjeventsrental.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default async (req, context) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders
      }
    });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

    if (!apiKey || !playlistId) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
          missing: {
            YOUTUBE_API_KEY: !apiKey,
            YOUTUBE_PLAYLIST_ID: !playlistId
          }
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "8");
    url.searchParams.set("key", apiKey);

    const youtubeResponse = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const youtubeData = await youtubeResponse.json();

    if (!youtubeResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "YouTube API request failed",
          status: youtubeResponse.status,
          details: youtubeData
        }),
        {
          status: youtubeResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const items = (youtubeData.items || [])
      .map((item) => {
        const snippet = item?.snippet || {};
        const thumbnails = snippet?.thumbnails || {};
        const videoId = snippet?.resourceId?.videoId || "";

        const thumbnail =
          thumbnails.maxres?.url ||
          thumbnails.standard?.url ||
          thumbnails.high?.url ||
          thumbnails.medium?.url ||
          thumbnails.default?.url ||
          "";

        return {
          videoId,
          title: snippet.title || "",
          description: snippet.description || "",
          publishedAt: snippet.publishedAt || "",
          videoPublishedAt: item?.contentDetails?.videoPublishedAt || "",
          thumbnail,
          url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""
        };
      })
      .filter((item) => item.videoId);

    return new Response(
      JSON.stringify({
        success: true,
        playlistId,
        count: items.length,
        items
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected server error",
        message: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
};
