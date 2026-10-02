export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Suka', color: 'text-brand-600' }, // mengikuti tema
  { type: 'love', emoji: '❤️', label: 'Super', color: 'text-rose-600' },
  { type: 'care', emoji: '🤗', label: 'Peduli', color: 'text-amber-600' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: 'text-amber-600' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-amber-600' },
  { type: 'sad', emoji: '😢', label: 'Sedih', color: 'text-amber-600' },
]

export const reactionOf = (type) => REACTIONS.find((r) => r.type === type)
