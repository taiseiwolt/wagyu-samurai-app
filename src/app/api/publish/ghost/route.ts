import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/publish/ghost
 * Publish a post to Ghost CMS via Admin API.
 */

export async function POST(req: NextRequest) {
  try {
    const ghostUrl = process.env.GHOST_URL;
    const ghostKey = process.env.GHOST_ADMIN_API_KEY;

    if (!ghostUrl || !ghostKey) {
      return NextResponse.json(
        { success: false, error: "Ghost is not configured yet" },
        { status: 400 }
      );
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return NextResponse.json(
        { success: false, error: "post_id is required" },
        { status: 400 }
      );
    }

    // Fetch post data
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select(
        "id, store_id, ghost_title, ghost_body, ghost_meta_desc, ghost_post_id"
      )
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    if (!post.ghost_title || !post.ghost_body) {
      return NextResponse.json(
        { success: false, error: "Ghost content has not been generated yet" },
        { status: 400 }
      );
    }

    // Get hero image (first processed photo)
    let heroImageUrl: string | null = null;
    const { data: media } = await supabaseAdmin
      .from("media")
      .select("processed_url")
      .eq("post_id", post_id)
      .eq("type", "photo")
      .eq("processing_status", "done")
      .limit(1);

    if (media && media.length > 0 && media[0].processed_url) {
      try {
        const urls = JSON.parse(media[0].processed_url);
        heroImageUrl = urls.portrait || urls.square || null;
      } catch {
        // processed_url might be a direct URL string
        heroImageUrl = media[0].processed_url;
      }
    }

    // Generate Ghost Admin API JWT
    const [id, secret] = ghostKey.split(":");
    const token = jwt.sign({}, Buffer.from(secret, "hex"), {
      keyid: id,
      algorithm: "HS256",
      expiresIn: "5m",
      audience: "/admin/",
    });

    // Publish to Ghost
    const ghostRes = await fetch(`${ghostUrl}/ghost/api/admin/posts/`, {
      method: "POST",
      headers: {
        Authorization: `Ghost ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        posts: [
          {
            title: post.ghost_title,
            html: post.ghost_body,
            meta_description: post.ghost_meta_desc,
            status: "published",
            ...(heroImageUrl ? { feature_image: heroImageUrl } : {}),
          },
        ],
      }),
    });

    if (!ghostRes.ok) {
      const errText = await ghostRes.text();
      return NextResponse.json(
        {
          success: false,
          error: `Ghost API error (${ghostRes.status}): ${errText}`,
        },
        { status: 500 }
      );
    }

    const ghostData = await ghostRes.json();
    const ghostPostId = ghostData.posts?.[0]?.id;
    const ghostPostUrl = ghostData.posts?.[0]?.url;

    // Update posts table
    await supabaseAdmin
      .from("posts")
      .update({ ghost_post_id: ghostPostId })
      .eq("id", post_id);

    return NextResponse.json({
      success: true,
      ghost_post_id: ghostPostId,
      ghost_post_url: ghostPostUrl,
    });
  } catch (error) {
    console.error("Ghost publish error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Ghost publish failed",
      },
      { status: 500 }
    );
  }
}
