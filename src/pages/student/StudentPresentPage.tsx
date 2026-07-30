import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { StudentEntryScreen } from '../../components/StudentEntryScreen'
import { getErrorMessage, submitPresentationUrl } from '../../lib/api'
import { IDLE_STATUS, useStudentSession, type FieldStatus } from '../../lib/useStudentSession'

export function StudentPresentPage() {
  const {
    teams,
    setTeams,
    teamsLoading,
    teamsError,
    student,
    selectedTeamId,
    setSelectedTeamId,
    nameInput,
    setNameInput,
    entryStatus,
    setEntryStatus,
    handleStart,
    handleSwitchUser: switchUser,
  } = useStudentSession()

  const [presentationUrlInput, setPresentationUrlInput] = useState('')
  const [presentationStatus, setPresentationStatus] = useState<FieldStatus>(IDLE_STATUS)
  const presentationInitialized = useRef(false)

  // Prefill the presentation-url input once, from the student's own team.
  useEffect(() => {
    if (!student || presentationInitialized.current) return
    const myTeam = teams.find((team) => team.id === student.team_id)
    if (!myTeam) return
    setPresentationUrlInput(myTeam.presentation_url ?? '')
    presentationInitialized.current = true
  }, [teams, student])

  function handleSwitchUser() {
    switchUser()
    setPresentationUrlInput('')
    setPresentationStatus(IDLE_STATUS)
    presentationInitialized.current = false
  }

  async function handleSubmitPresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student) return

    setPresentationStatus({ state: 'saving' })
    try {
      await submitPresentationUrl(student.student_id, presentationUrlInput)
      setTeams((previous) =>
        previous.map((team) =>
          team.id === student.team_id ? { ...team, presentation_url: presentationUrlInput } : team,
        ),
      )
      setPresentationStatus({ state: 'saved' })
    } catch (err) {
      setPresentationStatus({ state: 'error', message: getErrorMessage(err) })
    }
  }

  if (teamsLoading) {
    return (
      <>
        <BrandHeader />
        <p className="page-status">불러오는 중...</p>
      </>
    )
  }

  if (teamsError) {
    return (
      <>
        <BrandHeader />
        <div className="page">
          <h1>오류</h1>
          <p className="error-text">{teamsError}</p>
        </div>
      </>
    )
  }

  if (!student) {
    return (
      <StudentEntryScreen
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
        nameInput={nameInput}
        onNameChange={(name) => {
          setNameInput(name)
          setEntryStatus(IDLE_STATUS)
        }}
        entryStatus={entryStatus}
        onSubmit={handleStart}
      />
    )
  }

  const myTeam = teams.find((team) => team.id === student.team_id)

  return (
    <>
      <BrandHeader />
      <div className="page">
        <div className="page-header-row">
          <h1>{student.student_name}</h1>
          <button type="button" onClick={handleSwitchUser}>
            다른 사람으로 전환
          </button>
        </div>
        <p className="page-subtitle">소속 팀: {student.team_name}</p>

        <section className="panel">
          <h2>우리 팀 발표자료 제출</h2>
          <p className="hint-text">
            다른 팀 학생과 심사위원이 확인할 수 있는 우리 팀({myTeam?.name ?? student.team_name})의
            발표자료 링크를 등록하세요. 팀원 누구나 제출/수정할 수 있습니다.
          </p>
          <form onSubmit={handleSubmitPresentation} className="stacked-form">
            <label htmlFor="presentation-url">발표자료 링크</label>
            <input
              id="presentation-url"
              type="url"
              placeholder="https://..."
              value={presentationUrlInput}
              onChange={(event) => {
                setPresentationUrlInput(event.target.value)
                setPresentationStatus(IDLE_STATUS)
              }}
            />
            <button type="submit" disabled={presentationStatus.state === 'saving'}>
              {presentationStatus.state === 'saving' ? '저장 중...' : '발표자료 링크 저장'}
            </button>
            {presentationStatus.state === 'saved' && <p className="hint-text">저장되었습니다.</p>}
            {presentationStatus.state === 'error' && (
              <p className="error-text">{presentationStatus.message}</p>
            )}
          </form>
        </section>

        <section className="panel">
          <h2>전체 팀 발표자료 보기</h2>
          <p className="hint-text">발표자료가 제출된 팀은 새 탭에서 바로 열 수 있습니다.</p>
          <div className="row-list">
            {teams.map((team) => (
              <div className="row-item" key={team.id}>
                <div className="row-item__main">
                  <div className="row-item__info">
                    <span className="row-item__title">{team.name}</span>
                  </div>
                  <div className="row-item__action">
                    {team.presentation_url ? (
                      <a
                        className="open-presentation-button"
                        href={team.presentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        발표 열기
                      </a>
                    ) : (
                      <span className="open-presentation-button open-presentation-button--disabled">
                        아직 제출되지 않음
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
