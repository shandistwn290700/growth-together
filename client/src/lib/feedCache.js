// Perbarui satu postingan di cache feed tanpa memuat ulang seluruh feed.
export const FEED_KEY = ['feed']

export function updatePostInFeed(queryClient, postId, update) {
  queryClient.setQueryData(FEED_KEY, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => (post.id === postId ? { ...post, ...update(post) } : post)),
      })),
    },
  )
}

export function removePostFromFeed(queryClient, postId) {
  queryClient.setQueryData(FEED_KEY, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((post) => post.id !== postId) })),
    },
  )
}

export function prependPostToFeed(queryClient, post) {
  queryClient.setQueryData(FEED_KEY, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page, i) => (i === 0 ? { ...page, items: [post, ...page.items] } : page)),
    },
  )
}
