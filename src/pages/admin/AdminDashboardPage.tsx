import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage, getInvestorLeaderboard, getTeamLeaderboard } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { InvestorLeaderboardRow, TeamLeaderboardRow } from '../../lib/types'

const BEST_INVESTOR_PRIZE_COUNT = 8

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

export function AdminDashboardPage() {
  const navigate = useNavigate()

  const [teamRows, setTeamRows] = useState<TeamLeaderboardRow[] | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [investorRows, setInvestorRows] = useState<InvestorLeaderboardRow[] | null>(null)
  const [investorError, setInvestorError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getTeamLeaderboard()
      .then((rows) => {
        if (!cancelled) setTeamRows(rows)
      })
      .catch((err) => {
        if (!cancelled) setTeamError(getErrorMessage(err))
      })

    getInvestorLeaderboard()
      .then((rows) => {
        if (!cancelled) setInvestorRows(rows)
      })
      .catch((err) => {
        if (!cancelled) setInvestorError(getErrorMessage(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

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

      <section className="panel">
        <h2>팀 순위</h2>
        {teamError && (
          <p className="error-text">
            결과를 불러오지 못했습니다: {teamError}
            {teamError.includes('forbidden') && (
              <> — 이 계정이 아직 관리자로 등록되지 않았을 수 있습니다.</>
            )}
          </p>
        )}
        {!teamError && teamRows === null && <p className="page-status">불러오는 중...</p>}
        {!teamError && teamRows !== null && (
          <table className="data-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>팀</th>
                <th>심사 점수</th>
                <th>심사 인원</th>
                <th>투자 유치액</th>
                <th>투자자 수</th>
                <th>심사 백분위</th>
                <th>투자 백분위</th>
                <th>최종 점수</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row, index) => (
                <tr key={row.team_id}>
                  <td>{index + 1}</td>
                  <td>{row.team_name}</td>
                  <td>{row.judge_score}</td>
                  <td>{row.judges_scored_count}</td>
                  <td>{row.investment_received.toLocaleString()}</td>
                  <td>{row.investor_count}</td>
                  <td>{formatPercent(row.judge_percentile)}</td>
                  <td>{formatPercent(row.investment_percentile)}</td>
                  <td>{row.final_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>베스트 인베스터</h2>
        <p className="hint-text">상위 {BEST_INVESTOR_PRIZE_COUNT}명은 50,000원 상금 대상입니다 (강조 표시).</p>
        {investorError && (
          <p className="error-text">
            결과를 불러오지 못했습니다: {investorError}
            {investorError.includes('forbidden') && (
              <> — 이 계정이 아직 관리자로 등록되지 않았을 수 있습니다.</>
            )}
          </p>
        )}
        {!investorError && investorRows === null && <p className="page-status">불러오는 중...</p>}
        {!investorError && investorRows !== null && (
          <table className="data-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>학생</th>
                <th>소속 팀</th>
                <th>총 투자액</th>
                <th>최종 가치</th>
                <th>수익</th>
              </tr>
            </thead>
            <tbody>
              {investorRows.map((row, index) => {
                const isPrizeWinner = index < BEST_INVESTOR_PRIZE_COUNT
                return (
                  <tr key={row.student_id} style={isPrizeWinner ? { fontWeight: 600 } : undefined}>
                    <td>
                      {index + 1}
                      {isPrizeWinner && ' 🏆'}
                    </td>
                    <td>{row.student_name}</td>
                    <td>{row.team_name}</td>
                    <td>{row.total_invested.toLocaleString()}</td>
                    <td>{row.final_value.toLocaleString()}</td>
                    <td>{row.profit.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
