import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="page">
      <h1>2026 AI 에너지 스마트홈 메이커톤</h1>
      <p>투자 심사 사이트에 오신 것을 환영합니다.</p>
      <section className="panel">
        <p>
          <Link to="/invest">학생으로 시작하기</Link>
        </p>
        <p className="hint-text">소속 팀과 이름을 입력하면 투자 페이지로 이동합니다.</p>
      </section>
      <section className="panel">
        <p>
          <Link to="/judge">심사위원으로 시작하기</Link>
        </p>
        <p className="hint-text">이름과 공유받은 암호를 입력하면 채점 페이지로 이동합니다.</p>
      </section>
    </div>
  )
}
