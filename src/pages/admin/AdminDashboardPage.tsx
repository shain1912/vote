import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../../components/BrandHeader'
import {
  getErrorMessage,
  getInvestmentRecords,
  getInvestorLeaderboard,
  getJudgeScoreRecords,
  getTeamLeaderboard,
  resetEventData,
} from '../../lib/api'
import { isForbiddenError, loadAdminPassphrase, storeAdminPassphrase } from '../../lib/adminAuth'
import { downloadCsv, rowsToCsv, todayDateString } from '../../lib/csv'
import type { InvestorLeaderboardRow, TeamLeaderboardRow } from '../../lib/types'

const BEST_INVESTOR_PRIZE_COUNT = 8

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

interface CsvDownloadStatus {
  state: 'idle' | 'loading' | 'error'
  message?: string
}

const IDLE_CSV_STATUS: CsvDownloadStatus = { state: 'idle' }

interface ResetStatus {
  state: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

const IDLE_RESET_STATUS: ResetStatus = { state: 'idle' }

// Typed exactly, not just "any non-empty text" — this is the confirmation
// gate for a genuinely destructive, irreversible action (wipes real
// investments/scores/registrations), so a single dismissible
// window.confirm() isn't enough; see handleResetEventData.
const RESET_CONFIRM_WORD = '초기화'

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const passphrase = loadAdminPassphrase()

  const [teamRows, setTeamRows] = useState<TeamLeaderboardRow[] | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [investorRows, setInvestorRows] = useState<InvestorLeaderboardRow[] | null>(null)
  const [investorError, setInvestorError] = useState<string | null>(null)

  const [investmentCsvStatus, setInvestmentCsvStatus] = useState<CsvDownloadStatus>(IDLE_CSV_STATUS)
  const [judgeCsvStatus, setJudgeCsvStatus] = useState<CsvDownloadStatus>(IDLE_CSV_STATUS)

  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetStatus, setResetStatus] = useState<ResetStatus>(IDLE_RESET_STATUS)
  // Bumped after a successful reset so the leaderboard-fetching effect
  // below re-runs and picks up the now-empty data, without needing a
  // manual page refresh.
  const [refetchGeneration, setRefetchGeneration] = useState(0)

  // A "forbidden" response means the cached passphrase is stale/wrong —
  // AdminRouteGuard only checks that *something* is cached, not that it's
  // still valid, so this is the one place that has to react to that by
  // bouncing back to /admin/login instead of leaving a dead error state.
  function handleForbidden(message: string): boolean {
    if (!isForbiddenError(message)) return false
    storeAdminPassphrase(null)
    navigate('/admin/login', { replace: true })
    return true
  }

  useEffect(() => {
    if (!passphrase) return
    let cancelled = false

    getTeamLeaderboard(passphrase)
      .then((rows) => {
        if (!cancelled) setTeamRows(rows)
      })
      .catch((err) => {
        if (cancelled) return
        const message = getErrorMessage(err)
        if (!handleForbidden(message)) setTeamError(message)
      })

    getInvestorLeaderboard(passphrase)
      .then((rows) => {
        if (!cancelled) setInvestorRows(rows)
      })
      .catch((err) => {
        if (cancelled) return
        const message = getErrorMessage(err)
        if (!handleForbidden(message)) setInvestorError(message)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passphrase, refetchGeneration])

  function handleSignOut() {
    storeAdminPassphrase(null)
    navigate('/admin/login', { replace: true })
  }

  // Raw per-record CSVs behind the aggregated leaderboards above — "who
  // invested how much in which team" / "who scored which team with what
  // breakdown", not just the totals. Empty datasets still download fine
  // (rowsToCsv with zero data rows is just the header line).
  async function handleDownloadInvestmentCsv() {
    if (!passphrase) return
    setInvestmentCsvStatus({ state: 'loading' })
    try {
      const rows = await getInvestmentRecords(passphrase)
      const csv = rowsToCsv(
        ['학생명', '소속팀', '투자대상팀', '투자금액', '업데이트 시각'],
        rows.map((row) => [
          row.student_name,
          row.student_team,
          row.invested_in_team,
          row.amount,
          row.updated_at,
        ]),
      )
      downloadCsv(`투자내역_${todayDateString()}.csv`, csv)
      setInvestmentCsvStatus(IDLE_CSV_STATUS)
    } catch (err) {
      const message = getErrorMessage(err)
      if (!handleForbidden(message)) setInvestmentCsvStatus({ state: 'error', message })
    }
  }

  async function handleDownloadJudgeCsv() {
    if (!passphrase) return
    setJudgeCsvStatus({ state: 'loading' })
    try {
      const rows = await getJudgeScoreRecords(passphrase)
      const csv = rowsToCsv(
        ['심사위원명', '팀명', '문제정의/임팩트', '기술완성도', '실현가능성/확장성', 'UX/발표', '총점', '업데이트 시각'],
        rows.map((row) => [
          row.judge_name,
          row.team_name,
          row.problem_impact,
          row.technical_completeness,
          row.feasibility_scalability,
          row.ux_presentation,
          row.total,
          row.updated_at,
        ]),
      )
      downloadCsv(`심사내역_${todayDateString()}.csv`, csv)
      setJudgeCsvStatus(IDLE_CSV_STATUS)
    } catch (err) {
      const message = getErrorMessage(err)
      if (!handleForbidden(message)) setJudgeCsvStatus({ state: 'error', message })
    }
  }

  // Genuinely destructive and irreversible (wipes real investments/scores/
  // registrations for the whole event), so this only runs once the admin
  // has typed RESET_CONFIRM_WORD exactly — the button stays disabled
  // otherwise. That's the real guard against an accidental misclick; this
  // function itself re-checks it too as a second line of defense.
  async function handleResetEventData() {
    if (!passphrase) return
    if (resetConfirmText !== RESET_CONFIRM_WORD) return

    setResetStatus({ state: 'loading' })
    try {
      await resetEventData(passphrase)
      setResetStatus({
        state: 'success',
        message: '초기화 완료: 투자·채점·학생·심사위원 데이터가 모두 삭제되었습니다.',
      })
      setResetConfirmText('')
      // Reflect the now-empty state without requiring a manual page
      // refresh: clear the currently-displayed rows/errors so the
      // leaderboards show "불러오는 중..." while the effect below refetches.
      setTeamRows(null)
      setTeamError(null)
      setInvestorRows(null)
      setInvestorError(null)
      setRefetchGeneration((generation) => generation + 1)
    } catch (err) {
      const message = getErrorMessage(err)
      if (!handleForbidden(message)) setResetStatus({ state: 'error', message })
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page">
        <div className="page-header-row">
          <h1>결과 대시보드</h1>
          <div className="page-header-row__actions">
            <Link to="/admin/draw" className="header-link-button">
              발표 순서 추첨
            </Link>
            <button type="button" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
        </div>
        <p className="page-subtitle">이 페이지는 관리자에게만 표시됩니다.</p>

        <section className="panel">
          <h2>원본 데이터 다운로드</h2>
          <p className="hint-text">
            아래 순위표는 집계된 결과입니다. 팀별·학생별로 누가 어디에 얼마를 투자했는지, 심사위원이
            각 팀에 항목별로 몇 점을 줬는지 원본 내역이 필요하면 CSV로 내려받으세요 (엑셀에서 바로
            열립니다).
          </p>
          <div className="page-header-row__actions">
            <button
              type="button"
              onClick={handleDownloadInvestmentCsv}
              disabled={investmentCsvStatus.state === 'loading'}
            >
              {investmentCsvStatus.state === 'loading' ? '다운로드 중...' : '투자 내역 CSV 다운로드'}
            </button>
            <button
              type="button"
              onClick={handleDownloadJudgeCsv}
              disabled={judgeCsvStatus.state === 'loading'}
            >
              {judgeCsvStatus.state === 'loading' ? '다운로드 중...' : '심사 내역 CSV 다운로드'}
            </button>
          </div>
          {investmentCsvStatus.state === 'error' && (
            <p className="error-text">투자 내역 다운로드 실패: {investmentCsvStatus.message}</p>
          )}
          {judgeCsvStatus.state === 'error' && (
            <p className="error-text">심사 내역 다운로드 실패: {judgeCsvStatus.message}</p>
          )}
        </section>

        <section className="panel">
          <h2>팀 순위</h2>
          {teamError && <p className="error-text">결과를 불러오지 못했습니다: {teamError}</p>}
          {!teamError && teamRows === null && <p className="page-status">불러오는 중...</p>}
          {!teamError && teamRows !== null && (
            <div className="row-list">
              {teamRows.map((row, index) => (
                <div className="leaderboard-row" key={row.team_id}>
                  <div className="leaderboard-row__identity">
                    <span className={`rank-badge${index < 3 ? ' rank-badge--top' : ''}`}>
                      {index + 1}
                    </span>
                    <div className="leaderboard-row__name-block">
                      <span className="leaderboard-row__name">{row.team_name}</span>
                      <span className="leaderboard-row__meta">
                        심사 {row.judges_scored_count}명 · 투자자 {row.investor_count}명
                      </span>
                    </div>
                  </div>
                  <div className="leaderboard-row__stats">
                    <div className="stat">
                      <span className="stat__label">심사 점수</span>
                      <span className="stat__value">{row.judge_score}</span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">투자 유치액</span>
                      <span className="stat__value">{row.investment_received.toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">심사 백분위</span>
                      <span className="stat__value">{formatPercent(row.judge_percentile)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">투자 백분위</span>
                      <span className="stat__value">{formatPercent(row.investment_percentile)}</span>
                    </div>
                    <div className="stat stat--primary">
                      <span className="stat__label">최종 점수</span>
                      <span className="stat__value">{row.final_score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>베스트 인베스터</h2>
          <p className="hint-text">
            상위 {BEST_INVESTOR_PRIZE_COUNT}명은 50,000원 상금 대상입니다 (강조 표시).
          </p>
          {investorError && (
            <p className="error-text">결과를 불러오지 못했습니다: {investorError}</p>
          )}
          {!investorError && investorRows === null && <p className="page-status">불러오는 중...</p>}
          {!investorError && investorRows !== null && (
            <div className="row-list">
              {investorRows.map((row, index) => {
                const isPrizeWinner = index < BEST_INVESTOR_PRIZE_COUNT
                return (
                  <div
                    className={`leaderboard-row${isPrizeWinner ? ' leaderboard-row--prize' : ''}`}
                    key={row.student_id}
                  >
                    <div className="leaderboard-row__identity">
                      <span className={`rank-badge${isPrizeWinner ? ' rank-badge--top' : ''}`}>
                        {index + 1}
                      </span>
                      <div className="leaderboard-row__name-block">
                        <span className="leaderboard-row__name">
                          {row.student_name}
                          {isPrizeWinner && ' 🏆'}
                        </span>
                        <span className="leaderboard-row__meta">{row.team_name}</span>
                      </div>
                    </div>
                    <div className="leaderboard-row__stats">
                      <div className="stat">
                        <span className="stat__label">총 투자액</span>
                        <span className="stat__value">{row.total_invested.toLocaleString()}</span>
                      </div>
                      <div className="stat">
                        <span className="stat__label">최종 가치</span>
                        <span className="stat__value">{row.final_value.toLocaleString()}</span>
                      </div>
                      <div className="stat stat--primary">
                        <span className="stat__label">수익</span>
                        <span className="stat__value">{row.profit.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel panel--danger">
          <h2>모의테스트 데이터 초기화</h2>
          <p className="error-text">
            이 작업은 되돌릴 수 없습니다. 모든 학생·심사위원 등록, 투자 내역, 채점 내역이 즉시
            삭제되고 발표 순서·발표자료 링크도 초기화됩니다 (팀 목록 자체와 암호는 그대로
            유지됩니다). 실제 행사 중에는 절대 누르지 마세요 — 모의테스트가 끝난 뒤 데이터를 정리할
            때만 사용하세요.
          </p>
          <div className="stacked-form">
            <label htmlFor="reset-confirm">
              계속하려면 아래 입력란에 정확히 &quot;{RESET_CONFIRM_WORD}&quot;를 입력하세요
            </label>
            <input
              id="reset-confirm"
              type="text"
              value={resetConfirmText}
              onChange={(event) => {
                setResetConfirmText(event.target.value)
                setResetStatus(IDLE_RESET_STATUS)
              }}
              placeholder={RESET_CONFIRM_WORD}
              autoComplete="off"
            />
            <button
              type="button"
              className="button--danger"
              onClick={handleResetEventData}
              disabled={resetConfirmText !== RESET_CONFIRM_WORD || resetStatus.state === 'loading'}
            >
              {resetStatus.state === 'loading' ? '초기화 중...' : '모의테스트 데이터 초기화'}
            </button>
          </div>
          {resetStatus.state === 'success' && <p className="hint-text">{resetStatus.message}</p>}
          {resetStatus.state === 'error' && (
            <p className="error-text">초기화 실패: {resetStatus.message}</p>
          )}
        </section>
      </div>
    </>
  )
}
