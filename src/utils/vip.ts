export type VipTier =
  | 'Stardust'
  | 'Comet'
  | 'Asteroid'
  | 'Planet'
  | 'Star'
  | 'Supernova'
  | 'Black Hole Elite'

const VIP_THRESHOLDS: { tier: VipTier; wager: number }[] = [
  { tier: 'Stardust', wager: 0 },
  { tier: 'Comet', wager: 5_000 },
  { tier: 'Asteroid', wager: 25_000 },
  { tier: 'Planet', wager: 100_000 },
  { tier: 'Star', wager: 500_000 },
  { tier: 'Supernova', wager: 2_000_000 },
  { tier: 'Black Hole Elite', wager: 10_000_000 },
]

export function calculateVipTier(totalWagered: number): { tier: VipTier; progress: number } {
  let currentTierIndex = 0
  for (let i = VIP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalWagered >= VIP_THRESHOLDS[i].wager) {
      currentTierIndex = i
      break
    }
  }

  const current = VIP_THRESHOLDS[currentTierIndex]
  const next = VIP_THRESHOLDS[currentTierIndex + 1]

  if (!next) {
    return { tier: current.tier, progress: 100 }
  }

  const progress = ((totalWagered - current.wager) / (next.wager - current.wager)) * 100
  return { tier: current.tier, progress: Math.min(100, Math.max(0, progress)) }
}
