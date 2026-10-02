// Postingan tampil di beberapa daftar (feed Beranda, timeline profil). Semua daftar itu
// memakai query key berawalan 'posts', jadi satu perubahan bisa diterapkan ke semuanya.
export const FEED_KEY = ['posts', 'feed']
export const timelineKey = (studentId, classroomId) => ['posts', 'timeline', studentId, classroomId ?? 'all']
// Satu postingan saja (dipakai penampil foto dari galeri profil).
export const postKey = (postId) => ['posts', 'one', postId]
const ALL_POST_LISTS = { queryKey: ['posts'] }

const mapItems = (data, fn) => data?.pages && { ...data, pages: data.pages.map((page) => ({ ...page, items: fn(page.items) })) }

export function updatePost(queryClient, postId, update) {
  queryClient.setQueriesData(ALL_POST_LISTS, (data) => {
    if (data?.pages) return mapItems(data, (items) => items.map((post) => (post.id === postId ? { ...post, ...update(post) } : post)))
    return data?.id === postId ? { ...data, ...update(data) } : data
  })
}

export function removePost(queryClient, postId) {
  queryClient.setQueriesData(ALL_POST_LISTS, (data) => mapItems(data, (items) => items.filter((post) => post.id !== postId)))
  queryClient.removeQueries({ queryKey: postKey(postId) })
  queryClient.invalidateQueries({ queryKey: ['gallery'] })
  queryClient.invalidateQueries({ queryKey: ['student'] })
}

export function addNewPost(queryClient, post) {
  queryClient.setQueryData(FEED_KEY, (data) =>
    data && { ...data, pages: data.pages.map((page, i) => (i === 0 ? { ...page, items: [post, ...page.items] } : page)) },
  )
  queryClient.invalidateQueries({ queryKey: ['posts', 'timeline'] })
  queryClient.invalidateQueries({ queryKey: ['gallery'] })
  queryClient.invalidateQueries({ queryKey: ['student'] })
}
