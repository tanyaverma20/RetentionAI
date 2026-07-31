import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { commentService } from '../services/workflowService';

function buildTree(comments) {
  const byId = new Map(comments.map((c) => [c._id, { ...c, replies: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId).replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

function CommentNode({ comment, onReply, depth = 0 }) {
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  return (
    <div className={depth > 0 ? 'ml-6 mt-2 pl-3 border-l border-slate-800' : 'mt-3'}>
      <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-200">{comment.authorUserId?.name || 'Unknown'}</span>
          <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-xs text-slate-300 whitespace-pre-wrap">{comment.body}</p>
        <button onClick={() => setReplying((r) => !r)} className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-1">
          Reply
        </button>
        {replying && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
              placeholder="Write a reply..."
            />
            <button
              onClick={async () => {
                if (!replyBody.trim()) return;
                await onReply(replyBody, comment._id);
                setReplyBody('');
                setReplying(false);
              }}
              className="px-2 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            >
              Send
            </button>
          </div>
        )}
      </div>
      {comment.replies?.map((r) => (
        <CommentNode key={r._id} comment={r} onReply={onReply} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function CommentThread({ entityType, entityId }) {
  const { user } = useSelector((state) => state.auth);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await commentService.list(entityType, entityId);
      setComments(result);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async (text, parentCommentId = null) => {
    await commentService.create({ entityType, entityId, body: text, parentCommentId });
    await load();
  };

  const tree = buildTree(comments);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
          placeholder={`Comment as ${user?.name || 'you'}...`}
        />
        <button
          onClick={async () => { if (!body.trim()) return; await handlePost(body); setBody(''); }}
          className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
        >
          Post
        </button>
      </div>
      {loading && <p className="text-xs text-slate-500 italic">Loading comments...</p>}
      {!loading && tree.length === 0 && <p className="text-xs text-slate-500 italic">No comments yet.</p>}
      {tree.map((c) => (
        <CommentNode key={c._id} comment={c} onReply={handlePost} />
      ))}
    </div>
  );
}
