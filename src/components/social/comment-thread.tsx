"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownRight, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { TimeAgo } from "@/components/ui/time-ago";
import { addComment, deleteComment } from "@/lib/actions/social";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn, haptic } from "@/lib/utils";
import { useMotionPreset } from "@/hooks/use-motion-preset";
import { REDUCED } from "@/lib/motion";

/** Height of the fixed tab bar, plus the iPhone home indicator. */
const TAB_BAR_OFFSET = "calc(52px + env(safe-area-inset-bottom, 0px))";

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  parentId: string | null;
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
};

export function CommentThread({
  postId,
  comments,
  currentUserId,
  currentUserName,
  currentUserImage,
}: {
  postId: string;
  comments: Comment[];
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
}) {
  const { enabled } = useMotionPreset();
  const [, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useKeyboardInset();

  const [optimistic, addOptimistic] = useOptimistic(
    comments,
    (state, next: Comment) => [...state, next],
  );

  const roots = optimistic.filter((c) => !c.parentId);
  const repliesOf = (id: string) =>
    optimistic.filter((c) => c.parentId === id);

  function submit() {
    const text = body.trim();
    if (!text) return;
    haptic.light();
    setBody("");
    const parentId = replyTo?.parentId ?? replyTo?.id ?? null;
    setReplyTo(null);

    startTransition(async () => {
      addOptimistic({
        id: `optimistic-${Date.now()}`,
        body: text,
        createdAt: new Date(),
        parentId,
        userId: currentUserId,
        name: currentUserName,
        username: null,
        image: currentUserImage,
      });
      await addComment(postId, text, parentId);
    });
  }

  return (
    <div className="mt-5">
      <h2 className="text-text-3 px-4 pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {optimistic.length === 0
          ? "No comments yet"
          : `${optimistic.length} comment${optimistic.length === 1 ? "" : "s"}`}
      </h2>

      <div className="px-4">
        <AnimatePresence initial={false}>
          {roots.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: enabled ? 6 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={enabled ? { duration: 0.22 } : REDUCED}
            >
              <CommentRow
                comment={c}
                canDelete={c.userId === currentUserId}
                onReply={() => {
                  setReplyTo(c);
                  inputRef.current?.focus();
                }}
              />
              {repliesOf(c.id).map((r) => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  indented
                  canDelete={r.userId === currentUserId}
                  onReply={() => {
                    setReplyTo(r);
                    inputRef.current?.focus();
                  }}
                />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom-docked composer. It has to clear the tab bar when the keyboard
          is closed, and sit flush on the keyboard when it's open (at which
          point the keyboard covers the tab bar anyway). z-50 keeps it above
          the tab bar in both states. */}
      <div
        className="glass hairline-t fixed inset-x-0 z-50 inset-safe-x"
        style={{
          bottom: keyboardInset > 0 ? keyboardInset : TAB_BAR_OFFSET,
          paddingBottom: keyboardInset > 0 ? 0 : undefined,
        }}
      >
        <div className="mx-auto max-w-lg px-3 py-2">
          {replyTo && (
            <div className="text-text-3 mb-1.5 flex items-center gap-1.5 px-1 text-[12px]">
              <CornerDownRight className="size-3.5" />
              Replying to {replyTo.name}
              <button
                onClick={() => setReplyTo(null)}
                className="text-volt ml-auto font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Avatar src={currentUserImage} name={currentUserName} size="sm" />
            <input
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Add a comment…"
              maxLength={500}
              enterKeyHint="send"
              className="bg-surface-2 border-hairline rounded-field text-text-1 placeholder:text-text-3 focus:border-volt/60 h-10 min-w-0 flex-1 border px-3 text-[16px] outline-none"
            />
            <button
              onClick={submit}
              disabled={!body.trim()}
              aria-label="Post comment"
              className={cn(
                "press grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                body.trim()
                  ? "bg-volt text-black"
                  : "bg-surface-2 text-text-3",
              )}
            >
              <Send className="size-4" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>

      {/* Clearance for the fixed composer sitting above the tab bar. */}
      <div className="h-24" />
    </div>
  );
}

function CommentRow({
  comment,
  indented,
  canDelete,
  onReply,
}: {
  comment: Comment;
  indented?: boolean;
  canDelete: boolean;
  onReply: () => void;
}) {
  const [deleted, setDeleted] = useState(false);
  const [, startTransition] = useTransition();
  if (deleted) return null;

  return (
    <div className={cn("flex gap-2.5 py-2.5", indented && "pl-9")}>
      <Link href={`/u/${comment.username ?? comment.userId}`}>
        <Avatar src={comment.image} name={comment.name} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <Link
            href={`/u/${comment.username ?? comment.userId}`}
            className="font-semibold"
          >
            {comment.name}
          </Link>{" "}
          <TimeAgo
            date={comment.createdAt}
            className="text-text-3 text-[12px]"
          />
        </p>
        <p className="text-text-2 mt-0.5 text-[14px] leading-snug break-words">
          {comment.body}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={onReply}
            className="text-text-3 press text-[12px] font-semibold"
          >
            Reply
          </button>
          {canDelete && (
            <button
              onClick={() => {
                setDeleted(true);
                startTransition(async () => {
                  await deleteComment(comment.id);
                });
              }}
              aria-label="Delete comment"
              className="text-text-3 press"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
