export default {
  build: {
    contents: "contents",
    pages: "pages",
    dist: "dist",
    contentSlug: "post",
  },
  site: { title: "Jeong-ki", auther: "Jeong-ki" },
  updatePost(post) {
    post.created_at = post.created_at.toLocaleDateString();
    return post;
  },
};
