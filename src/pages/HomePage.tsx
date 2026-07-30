import { Link } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'

export function HomePage() {
  return (
    <>
      <BrandHeader />
      <div className="centered-stage">
        <div className="entry-card">
          <h1>2026 AI 에너지 스마트홈 메이커톤</h1>
          <p className="hint-text">투자 심사 사이트에 오신 것을 환영합니다.</p>
          <div className="entry-card__choices">
            <Link to="/invest" className="choice-button">
              <span className="choice-button__title">학생으로 시작하기</span>
              <span className="choice-button__desc">
                소속 팀과 이름을 입력하면 투자 페이지로 이동합니다. 발표자료 등록·보기는 아래 메뉴를
                이용하세요.
              </span>
            </Link>
            <Link to="/present" className="choice-button">
              <span className="choice-button__title">발표자료 등록·보기</span>
              <span className="choice-button__desc">
                소속 팀과 이름을 입력하면 우리 팀 발표자료를 등록하고 다른 팀 발표자료를 열어볼 수
                있습니다.
              </span>
            </Link>
            <Link to="/judge" className="choice-button">
              <span className="choice-button__title">심사위원으로 시작하기</span>
              <span className="choice-button__desc">
                이름과 공유받은 암호를 입력하면 채점 페이지로 이동합니다.
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
