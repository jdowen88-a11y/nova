export type VipTier =
  | 'Stardust'
  | 'Comet'
  | 'Asteroid'
  | 'Planet'
  | 'Star'
  | 'Supernova'
  | 'Black Hole Elite'

const VIP_THRESHOLDS = [
  { tier: 'Stardust', minWager: 0 },
  { tier: 'Comet', minWager: 5_000 },
  { tier: 'Asteroid', minWager: 25_000 },
  { tier: 'Planet', minWager: 100_000 },
  { tier: 'Star', minWager: 500_000 },
  { tier: 'Supernova', minWager: 2_000_000 },
  { tier: 'Black Hole Elite', minWager: 10_000_000 },
] as const satisfies readonly { tier: VipTier; minWager: number }[]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function calculateVipTier(totalWagered: number): { tier: VipTier; progress: number } {
  const wagered = Math.max(0, totalWagered)

  let currentIndex = 0
  for (let i = VIP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (wagered >= VIP_THRESHOLDS[i].minWager) {
      currentIndex = i
      break
    }
  }

  const current = VIP_THRESHOLDS[currentIndex]
  const next = VIP_THRESHOLDS[currentIndex + 1]

  if (!next) return { tier: current.tier, progress: 100 }

  const progress = ((wagered - current.minWager) / (next.minWager - current.minWager)) * 100
  return { tier: current.tier, progress: clamp(progress, 0, 100) }
}

