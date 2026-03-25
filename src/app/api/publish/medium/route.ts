import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/publish/medium
 * Publish a post to Medium via their API.
 */

export async function POST(req: NextRequest) {
  try {
    const mediumToken = process.env.MEDIUM_INTEGRATION_TOKEN;

    if (!mediumToken) {
      return NextResponse.json(
        { success: false, error: "Medium is not configured yet" },
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
        "id, store_id, ghost_title, ghost_post_id, medium_body, medium_post_id"
      )
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    if (!post.medium_body) {
      return NextResponse.json(
        { success: false, error: "Medium content has not been generated yet" },
        { status: 400 }
      );
    }

    // Get Medium user ID
    const meRes = await fetch("https://api.medium.com/v1/me", {
      headers: {
        Authorization: `Bearer ${mediumToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meRes.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to authenticate with Medium" },
        { status: 500 }
      );
    }

    const meData = await meRes.json();
    const userId = meData.data?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Could not get Medium user ID" },
        { status: 500 }
      );
    }

    // Append Ghost link if available
    let body = post.medium_body;
    if (post.ghost_post_id) {
      const ghostUrl = process.env.GHOST_URL;
      if (ghostUrl) {
        body += `\n\n---\n\n[Read the full article on our blog](${ghostUrl}/${post.ghost_post_id}/)`;
      }
    }

    // Publish to Medium
    const publishRes = await fetch(
      `https://api.medium.com/v1/users/${userId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mediumToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: post.ghost_title || "WAGYU SAMURAI",
          contentFormat: "markdown",
          content: body,
          tags: ["wagyu", "tokyo", "food", "japan", "restaurant"],
          publishStatus: "public",
        }),
      }
    );

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      return NextResponse.json(
        {
          success: false,
          error: `Medium API error (${publishRes.status}): ${errText}`,
        },
        { status: 500 }
      );
    }

    const publishData = await publishRes.json();
    const mediumPostId = publishData.data?.id;
    const mediumPostUrl = publishData.data?.url;

    // Update posts table
    await supabaseAdmin
      .from("posts")
      .update({ medium_post_id: mediumPostId })
      .eq("id", post_id);

    return NextResponse.json({
      success: true,
      medium_post_id: mediumPostId,
      medium_post_url: mediumPostUrl,
    });
  } catch (error) {
    console.error("Medium publish error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Medium publish failed",
      },
      { status: 500 }
    );
  }
}
