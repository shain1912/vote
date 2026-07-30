import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Dummy placeholder rows only, shaped loosely like a future leaderboard.
// TODO(scoring-design): replace with a real query that joins teams,
// investments, and judge_scores once those tables and the ranking formula
// exist. Nothing here (column names, row count, ordering) should be taken
// as final.
const DUMMY_RESULTS = [
  { rank: 1, teamName: '팀 A (예시)', investmentSignal: '—', judgeSignal: '—' },
  { rank: 2, teamName: '팀 B (예시)', investmentSignal: '—', judgeSignal: '—' },
  { rank: 3, teamName: '팀 C (예시)', investmentSignal: '—', judgeSignal: '—' },
  { rank: 4, teamName: '팀 D (예시)', investmentSignal: '—', judgeSignal: '—' },
  { rank: 5, teamName: '팀 E (예시)', investmentSignal: '—', judgeSignal: '—' },
]

export function AdminDashboardPage() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>결과 대시보드</h1>
        <button type="button" onClick={handleSignOut}>
          로그아웃
        </button>
      </div>
      <p className="page-subtitle">이 페이지는 관리자에게만 표시됩니다.</p>
      <p className="hint-text">아래 표는 더미 데이터입니다. 실제 순위 산정 로직은 아직 확정되지 않았습니다.</p>

      {/* TODO(scoring-design): fetch real standings here, e.g. a Supabase
          view/RPC that combines investment totals and judge scores per the
          finalized formula, ordered by final rank. */}
      <table className="data-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>팀</th>
            <th>투자 유치 (placeholder)</th>
            <th>심사 점수 (placeholder)</th>
          </tr>
        </thead>
        <tbody>
          {DUMMY_RESULTS.map((row) => (
            <tr key={row.rank}>
              <td>{row.rank}</td>
              <td>{row.teamName}</td>
              <td>{row.investmentSignal}</td>
              <td>{row.judgeSignal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
