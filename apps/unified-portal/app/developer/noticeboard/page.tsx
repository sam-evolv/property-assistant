'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { MessageCircle, Trash2, X } from 'lucide-react';

interface NoticeboardPost {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
}

interface Comment {
  id: string;
  author_name: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  unit_id?: string;
  development_id?: string;
}

type PostCategory = 'Announcement' | 'Reminder' | 'Update' | 'Event' | 'Maintenance';

export default function NoticeboardPage() {
  const [posts, setPosts] = useState<NoticeboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<NoticeboardPost | null>(null);

  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<NoticeboardPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Announcement' as PostCategory,
    priority: 0,
    active: true,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/noticeboard/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleViewComments = (post: NoticeboardPost) => {
    setSelectedPostForComments(post);
    setShowCommentsModal(true);
    fetchComments(post.id);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPostForComments) return;
    
    try {
      const res = await fetch(
        `/api/noticeboard/${selectedPostForComments.id}/comments?commentId=${commentId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setComments((prev) => prev.map((c) => 
          c.id === commentId ? { ...c, is_deleted: true } : c
        ));
        toast.success('Comment removed');
      } else {
        toast.error('Failed to delete comment');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/noticeboard');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      toast.error('Failed to load noticeboard posts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingPost ? `/api/noticeboard/${editingPost.id}` : '/api/noticeboard';
      const method = editingPost ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save post');

      toast.success(editingPost ? 'Post updated successfully' : 'Post created successfully');
      setShowCreateModal(false);
      setEditingPost(null);
      resetForm();
      fetchPosts();
    } catch (error) {
      console.error('Failed to save post:', error);
      toast.error('Failed to save post');
    }
  };

  const handleToggleActive = async (post: NoticeboardPost) => {
    try {
      const res = await fetch(`/api/noticeboard/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !post.active }),
      });

      if (!res.ok) throw new Error('Failed to toggle post status');

      toast.success(post.active ? 'Post unpublished' : 'Post published');
      fetchPosts();
    } catch (error) {
      console.error('Failed to toggle post:', error);
      toast.error('Failed to update post status');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const res = await fetch(`/api/noticeboard/${postId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete post');

      toast.success('Post deleted successfully');
      fetchPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleEdit = (post: NoticeboardPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      category: (post.category || 'Announcement') as PostCategory,
      priority: post.priority,
      active: post.active,
      start_date: post.start_date ? new Date(post.start_date).toISOString().split('T')[0] : '',
      end_date: post.end_date ? new Date(post.end_date).toISOString().split('T')[0] : '',
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'Announcement',
      priority: 0,
      active: true,
      start_date: '',
      end_date: '',
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Announcement':
        return 'bg-gold-50 text-gold-700';
      case 'Reminder':
        return 'bg-yellow-100 text-yellow-800';
      case 'Update':
        return 'bg-green-100 text-green-800';
      case 'Event':
        return 'bg-purple-100 text-purple-800';
      case 'Maintenance':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <SkeletonTable rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/developer" className="text-gold-500 hover:underline flex items-center gap-2 mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Noticeboard Management</h1>
              <p className="text-gray-600 mt-1">Create and manage announcements for homeowners</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingPost(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 transition flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Post
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          {posts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                }
                title="No Noticeboard Posts"
                description="Create your first announcement to communicate with homeowners"
                actionLabel="Create First Post"
                onAction={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comments
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{post.title}</p>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{post.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Created {new Date(post.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getCategoryColor(post.category)}`}>
                          {post.category || 'Announcement'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {post.start_date && (
                          <div className="text-xs">
                            <span className="text-gray-500">Start:</span> {new Date(post.start_date).toLocaleDateString()}
                          </div>
                        )}
                        {post.end_date && (
                          <div className="text-xs">
                            <span className="text-gray-500">End:</span> {new Date(post.end_date).toLocaleDateString()}
                          </div>
                        )}
                        {!post.start_date && !post.end_date && (
                          <span className="text-gray-400">No schedule</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(post)}
                          className={`px-3 py-1 text-xs font-semibold rounded transition ${
                            post.active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {post.active ? 'Published' : 'Draft'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleViewComments(post)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gold-600 hover:text-gold-700 hover:bg-gold-50 rounded-md transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                          View
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEdit(post)}
                          className="text-gold-500 hover:text-gold-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingPost ? 'Edit Post' : 'Create New Post'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="Enter post title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="Enter post content"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as PostCategory })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                    >
                      <option value="Announcement">Announcement</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Update">Update</option>
                      <option value="Event">Event</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Scheduling</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Publish Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave empty to publish immediately</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Expire Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave empty to show indefinitely</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-gold-500 rounded border-gray-300 focus:ring-gold-500"
                  />
                  <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
                    {formData.start_date ? 'Publish when scheduled' : 'Publish immediately'}
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingPost(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 transition"
                  >
                    {editingPost ? 'Update Post' : 'Create Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCommentsModal && selectedPostForComments && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Comments</h2>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{selectedPostForComments.title}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCommentsModal(false);
                    setSelectedPostForComments(null);
                    setComments([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No comments yet</p>
                    <p className="text-gray-400 text-sm mt-1">Comments from homeowners will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg border ${
                          comment.is_deleted 
                            ? 'bg-gray-50 border-gray-200 opacity-60' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{comment.author_name}</span>
                              <span className="text-xs text-gray-400">
                                {formatCommentDate(comment.created_at)}
                              </span>
                              {comment.is_deleted && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                                  Removed
                                </span>
                              )}
                            </div>
                            <p className={`text-sm ${comment.is_deleted ? 'text-gray-400 italic' : 'text-gray-700'} whitespace-pre-wrap break-words`}>
                              {comment.is_deleted ? '[Comment removed by moderator]' : comment.body}
                            </p>
                          </div>
                          {!comment.is_deleted && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              title="Remove comment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  {comments.filter(c => !c.is_deleted).length} active comments
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
