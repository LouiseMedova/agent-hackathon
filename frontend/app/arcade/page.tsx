import { NavBar } from '@/components/nav-bar'
import { PageAmbient } from '@/components/page-ambient'
import { SiteFooter } from '@/components/site-footer'
import { AgentArcadeGame } from '@/components/arcade/agent-arcade-game'

export default function ArcadePage() {
  return (
    <div className="min-h-screen bg-background">
      <PageAmbient />
      <NavBar />
      <main className="pt-[72px]">
        <AgentArcadeGame />
      </main>
      <SiteFooter />
    </div>
  )
}
