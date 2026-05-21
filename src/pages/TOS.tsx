import React, { useState } from 'react'

interface TOSProps {
  token: string
  onAccepted: () => void
}

export default function TOS({ token, onAccepted }: TOSProps) {
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    setAccepting(true)
    setError('')
    try {
      const res = await fetch('/api/user/accept-tos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json() as any
        setError(data.error ?? 'Failed to accept terms')
        return
      }
      onAccepted()
    } catch {
      setError('Network error')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cosmic-gradient text-star-white flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full bg-deep-space border border-nebula-gray/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-electric-purple/20 to-nebula-pink/10 px-8 py-6 border-b border-nebula-gray/20">
          <h1 className="text-2xl font-display font-bold text-white">Terms of Service</h1>
          <p className="text-white/50 text-sm mt-1">Version 2025-01 — Please read carefully before playing</p>
        </div>

        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-5 text-sm text-white/70 leading-7">
          <section>
            <h2 className="text-white font-semibold text-base mb-2">1. Sweepstakes Rules &amp; No-Purchase-Necessary</h2>
            <p>Nova Casino operates as a <strong className="text-white">free-to-play sweepstakes social casino</strong>. No purchase or payment of any kind is necessary to participate in any promotion or to obtain Nova Crystals (NC). Players may obtain free Nova Crystals through the Alternate Method Of Entry (AMOE) by mailing a written request to the address provided at no cost to the entrant.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">2. Eligible Participants</h2>
            <p>You must be <strong className="text-white">18 years of age or older</strong> (19+ in some jurisdictions) and a legal resident of an eligible territory to participate. Residents of <strong className="text-white">Idaho (ID), Washington (WA), Michigan (MI)</strong>, and other restricted jurisdictions are not eligible and may not participate. It is your sole responsibility to determine whether your jurisdiction permits participation in sweepstakes gaming.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">3. Virtual Currency</h2>
            <p>Gold Coins (GC) and Nova Crystals (NC) are virtual currencies with no real-world monetary value. GC are used for free-play games only. NC may be redeemable for prizes in accordance with applicable sweepstakes rules. Neither currency may be exchanged for real money or transferred between accounts.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">4. Responsible Gaming</h2>
            <p>Nova Casino provides tools to promote responsible gaming including self-exclusion (1–60 months) and session time limits. If you believe you have a gaming problem, please contact the National Problem Gambling Helpline at <strong className="text-white">1-800-522-4700</strong>.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">5. Provably Fair Gaming</h2>
            <p>All game results are generated using a provably fair algorithm based on HMAC-SHA256. The server seed hash is displayed before each round begins. After the round concludes, the server seed is revealed so players can independently verify the result.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">6. Account Rules</h2>
            <p>One account per person. Attempting to create multiple accounts, exploit bonuses, or manipulate game systems will result in permanent account termination and forfeiture of all balances. Nova Casino reserves the right to verify identity at any time.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">7. Privacy</h2>
            <p>We collect only the data necessary to operate the service. We do not sell your personal data to third parties. Birth year and month are stored to verify age eligibility; the full date of birth is never stored. See our Privacy Policy for full details.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">8. Modifications</h2>
            <p>Nova Casino reserves the right to modify these Terms at any time. Continued use of the service after modifications constitutes acceptance. Material changes will be communicated via email and/or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">9. Limitation of Liability</h2>
            <p>Nova Casino is provided "as is" without warranty of any kind. To the maximum extent permitted by law, Nova Casino shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">10. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration under AAA rules.</p>
          </section>
        </div>

        <div className="px-8 py-6 border-t border-nebula-gray/20 flex flex-col sm:flex-row items-center gap-4">
          {error && <p className="text-red-400 text-sm flex-1">{error}</p>}
          <div className="ml-auto flex gap-3">
            <a
              href="/"
              className="px-5 py-2.5 rounded-lg border border-nebula-gray/40 text-sm text-white/60 hover:text-white transition-all"
            >
              Decline
            </a>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="px-6 py-2.5 rounded-lg bg-purple-gradient font-semibold text-sm text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {accepting ? '⏳ Accepting…' : '✅ I Accept the Terms'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}