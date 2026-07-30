import type { Student, Team } from './types'

// Placeholder data ONLY — for wiring up the UI before real Supabase queries
// exist. Replace every usage of this file once the schema/queries land.
//
// TODO(scoring-design): delete this file once pages fetch real data.
export const DUMMY_TEAMS: Team[] = [
  {
    id: 'dummy-team-1',
    name: '팀 A (예시)',
    presentationUrl: 'https://example.com/team-a-deck',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-team-2',
    name: '팀 B (예시)',
    presentationUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-team-3',
    name: '팀 C (예시)',
    presentationUrl: 'https://example.com/team-c-deck',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-team-4',
    name: '팀 D (예시)',
    presentationUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
]

// A handful of dummy students spread across the teams above — enough to
// demonstrate that a student's own team is excluded from their investable
// list. The real makerthon has ~44 students across 15 teams.
export const DUMMY_STUDENTS: Student[] = [
  {
    id: 'dummy-student-1',
    name: '학생 1 (예시)',
    teamId: 'dummy-team-1',
    accessCode: 'demo-student-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-student-2',
    name: '학생 2 (예시)',
    teamId: 'dummy-team-1',
    accessCode: 'demo-student-2',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-student-3',
    name: '학생 3 (예시)',
    teamId: 'dummy-team-2',
    accessCode: 'demo-student-3',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dummy-student-4',
    name: '학생 4 (예시)',
    teamId: 'dummy-team-3',
    accessCode: 'demo-student-4',
    createdAt: '2026-01-01T00:00:00Z',
  },
]
