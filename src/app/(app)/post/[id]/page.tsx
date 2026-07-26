import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui/nav-bar";
import { PostCard } from "@/components/social/post-card";
import { CommentThread } from "@/components/social/comment-thread";
import { requireUser } from "@/lib/session";
import { getComments, getPost } from "@/lib/queries/social";

export default async function PostPage(props: PageProps<"/post/[id]">) {
  const { id } = await props.params;
  const me = await requireUser();

  const post = await getPost(id, me.id);
  if (!post) notFound();

  const comments = await getComments(id);

  return (
    <div className="pb-8">
      <NavBar title="Workout" back large={false} />
      <div className="px-4 pt-3">
        <PostCard item={post} unit={me.unit} />
      </div>
      <CommentThread
        postId={id}
        comments={comments}
        currentUserId={me.id}
        currentUserName={me.name}
        currentUserImage={me.image}
      />
    </div>
  );
}
