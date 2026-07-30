import type { FormEvent } from 'react'
import type { FieldStatus } from '../lib/useStudentSession'
import type { TeamSummary } from '../lib/types'
import { BrandHeader } from './BrandHeader'

interface StudentEntryScreenProps {
  teams: TeamSummary[]
  selectedTeamId: string
  onSelectTeam: (teamId: string) => void
  nameInput: string
  onNameChange: (name: string) => void
  entryStatus: FieldStatus
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/**
 * The team+name login card shared by /invest and /present (identical
 * mechanic — both call start_as_student and land the student on
 * different page-specific content afterward).
 */
export function StudentEntryScreen({
  teams,
  selectedTeamId,
  onSelectTeam,
  nameInput,
  onNameChange,
  entryStatus,
  onSubmit,
}: StudentEntryScreenProps) {
  return (
    <>
      <BrandHeader />
      <div className="centered-stage">
        <div className="entry-card">
          <h1>학생으로 시작하기</h1>
          <p className="hint-text">
            소속 팀과 이름을 입력하고 시작하세요. 이후 같은 팀 + 같은 이름으로 다시 들어오면 기존
            투자 내역과 발표자료가 그대로 이어집니다.
          </p>
          <form onSubmit={onSubmit} className="stacked-form">
            <label htmlFor="student-team">소속 팀</label>
            <select
              id="student-team"
              value={selectedTeamId}
              onChange={(event) => onSelectTeam(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <label htmlFor="student-name">이름</label>
            <input
              id="student-name"
              type="text"
              value={nameInput}
              onChange={(event) => onNameChange(event.target.value)}
            />

            <button type="submit" disabled={entryStatus.state === 'saving'}>
              {entryStatus.state === 'saving' ? '확인 중...' : '시작'}
            </button>
            {entryStatus.state === 'error' && <p className="error-text">{entryStatus.message}</p>}
          </form>
        </div>
      </div>
    </>
  )
}
