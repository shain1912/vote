import { Link } from 'react-router-dom'

// Small, consistent branding element shown at the top of every screen so
// the separate student/judge/admin pages read as one product. Purely
// presentational — no data, no logic.
export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link to="/" className="brand-header__mark">
        2026 메이커톤
      </Link>
    </header>
  )
}
