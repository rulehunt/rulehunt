// src/components/mobile/ui/starRating.ts

export interface StarRatingConfig {
  currentRating?: number
  onRate: (rating: number) => void
  isTransitioning: () => boolean
  readonly?: boolean
}

/**
 * Creates an interactive 5-star rating component
 *
 * @param config - Configuration object with callbacks
 * @returns Object with rating element and update function
 */
export function createStarRating(config: StarRatingConfig): {
  element: HTMLElement
  setRating: (rating: number) => void
  getRating: () => number
} {
  let currentRating = config.currentRating || 0
  let hoverRating = 0

  const container = document.createElement('div')
  container.className =
    'flex items-center gap-1 px-3 py-2 bg-black/50 rounded-lg select-none'

  const label = document.createElement('span')
  label.textContent = 'Rate:'
  label.className = 'text-white text-sm font-medium mr-1'
  container.appendChild(label)

  const stars: HTMLElement[] = []

  // Create 5 star buttons
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button')
    star.type = 'button'
    star.className = config.readonly
      ? 'text-2xl cursor-default'
      : 'text-2xl cursor-pointer hover:scale-110 transition-transform active:scale-95'
    star.innerHTML = '★'
    star.style.color = i <= currentRating ? '#fbbf24' : '#6b7280'
    star.dataset.rating = String(i)

    if (!config.readonly) {
      // Hover effects
      star.addEventListener('mouseenter', () => {
        if (config.isTransitioning()) return
        hoverRating = i
        updateStarColors(hoverRating)
      })

      // Click to rate
      star.addEventListener('click', () => {
        if (config.isTransitioning()) return
        currentRating = i
        config.onRate(i)
        updateStarColors(currentRating)
      })
    }

    stars.push(star)
    container.appendChild(star)
  }

  // Reset to current rating on mouse leave
  if (!config.readonly) {
    container.addEventListener('mouseleave', () => {
      hoverRating = 0
      updateStarColors(currentRating)
    })
  }

  function updateStarColors(rating: number) {
    stars.forEach((star, index) => {
      star.style.color = index + 1 <= rating ? '#fbbf24' : '#6b7280'
    })
  }

  function setRating(rating: number) {
    currentRating = rating
    updateStarColors(rating)
  }

  function getRating() {
    return currentRating
  }

  return { element: container, setRating, getRating }
}

/**
 * Creates a compact star rating display (read-only)
 * Shows average rating with star count
 *
 * @param avgRating - Average rating (0-5)
 * @param ratingCount - Number of ratings
 * @returns Display element
 */
export function createStarRatingDisplay(
  avgRating: number,
  ratingCount: number,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'flex items-center gap-1 text-sm'

  const fullStars = Math.floor(avgRating)
  const hasHalfStar = avgRating - fullStars >= 0.5

  // Render stars
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span')
    star.className = 'text-base'

    if (i < fullStars) {
      star.innerHTML = '★'
      star.style.color = '#fbbf24'
    } else if (i === fullStars && hasHalfStar) {
      star.innerHTML = '⯨'
      star.style.color = '#fbbf24'
    } else {
      star.innerHTML = '★'
      star.style.color = '#6b7280'
    }

    container.appendChild(star)
  }

  // Rating text
  const ratingText = document.createElement('span')
  ratingText.textContent = `${avgRating.toFixed(1)} (${ratingCount})`
  ratingText.className = 'text-gray-400 ml-1'
  container.appendChild(ratingText)

  return container
}
