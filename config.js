export default {
  build: {
    contents: "contents",
    pages: "pages",
    dist: "dist",
    contentSlug: "post",
    assets: "assets",
  },
  site: { title: "Blog", auther: "Jeong-ki" },
  updatePost(post) {
    post.created_at = post.created_at.toLocaleDateString().replaceAll("/", ".");
    return post;
  },
};
