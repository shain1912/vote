import { useEffect, useState, type FormEvent } from 'react'
import { getErrorMessage, listTeams, startAsStudent } from './api'
import type { StudentIdentity, TeamSummary } from './types'

// Shared across /invest and /present — a student logging in on either page
// resumes on the other without retyping, since both read/write this same
// sessionStorage key via this hook. Kept only for this browser tab's
// session — not a login credential (there is no per-person link/code).
// start_as_student would happily resume the same person again anyway if
// this were lost, as long as they pick the same team + type the same name.
const SESSION_KEY = 'makerthon:student-identity'

function loadStoredIdentity(): StudentIdentity | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StudentIdentity) : null
  } catch {
    return null
  }
}

function storeIdentity(identity: StudentIdentity | null) {
  try {
    if (identity) sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // sessionStorage can be unavailable in some environments — not fatal.
  }
}

export interface FieldStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

export const IDLE_STATUS: FieldStatus = { state: 'idle' }

/**
 * Shared team list + student identity/login state for /invest and
 * /present. Both pages render the same entry-card login form (see
 * StudentEntryScreen) when there's no identity yet, then branch into
 * page-specific content once identified.
 */
export function useStudentSession() {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const [student, setStudent] = useState<StudentIdentity | null>(() => loadStoredIdentity())

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [entryStatus, setEntryStatus] = useState<FieldStatus>(IDLE_STATUS)

  // Load all 15 teams once — needed for both the entry <select> and each
  // page's team list.
  useEffect(() => {
    let cancelled = false
    listTeams()
      .then((rows) => {
        if (cancelled) return
        setTeams(rows)
        setSelectedTeamId((previous) => previous || rows[0]?.id || '')
      })
      .catch((err) => {
        if (!cancelled) setTeamsError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = nameInput.trim()
    if (!trimmedName) {
      setEntryStatus({ state: 'error', message: '이름을 입력해주세요.' })
      return
    }
    if (!selectedTeamId) {
      setEntryStatus({ state: 'error', message: '팀을 선택해주세요.' })
      return
    }

    setEntryStatus({ state: 'saving' })
    try {
      const identity = await startAsStudent(selectedTeamId, trimmedName)
      storeIdentity(identity)
      setStudent(identity)
      setEntryStatus(IDLE_STATUS)
    } catch (err) {
      setEntryStatus({ state: 'error', message: getErrorMessage(err) })
    }
  }

  function handleSwitchUser() {
    storeIdentity(null)
    setStudent(null)
    setNameInput('')
    setEntryStatus(IDLE_STATUS)
  }

  return {
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
    handleSwitchUser,
  }
}
