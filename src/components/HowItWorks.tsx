import { ModalShell } from "./ModalShell";

// "How it works" 3단계 안내 — 온보딩 화면과 에디터의 온디맨드 오버레이가
// 같은 카피를 쓰도록 한곳에서 정의한다. 문구를 바꾸려면 여기만 고치면 된다.
// 영어 메인 + 작은 한국어 병기(en/ko).
const STEPS = [
  {
    en: "Dump your photos — Recapper reads each photo’s date and drops it onto the right day automatically.",
    ko: "사진을 올리면 촬영일을 읽어 알맞은 날짜에 자동으로 배치합니다.",
  },
  {
    en: "Tap any empty day to place a photo yourself — it doesn’t have to be taken on that date.",
    ko: "빈 날짜를 탭해 직접 올릴 수도 있습니다 — 그날 찍은 사진이 아니어도 됩니다.",
  },
  {
    en: "Your photos never leave your phone — no uploads.",
    ko: "서버에 업로드되지 않으며, 사진은 어디로도 전송되지 않고 이 기기에만 남습니다.",
  },
];

// 라벨 + 번호 리스트만 렌더(레이아웃 래핑은 호출자가 담당).
export function HowItWorksList() {
  return (
    <>
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-ink">
        How it works
      </p>
      <ol className="mt-2 space-y-2 text-[11px] font-semibold leading-relaxed text-muted">
        {STEPS.map((step, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="font-extrabold text-ink">{idx + 1}.</span>
            <span>
              {step.en}
              <span className="mt-0.5 block text-[10px] font-medium leading-snug text-muted/70">
                {step.ko}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

// 에디터에서 "How it works" 링크로 여는 오버레이 시트. 정렬·트랜지션은
// ModalShell이 담당(모바일 하단 slide-up / 데스크탑 중앙 fade).
export function HowItWorksSheet({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      onClose={onClose}
      panelClassName="w-full max-w-[460px] border border-ink bg-paper px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5"
    >
      {(close) => (
        <>
          <HowItWorksList />
          <button
            type="button"
            onClick={close}
            className="mt-5 w-full rounded-pill bg-ink py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white active:opacity-80"
          >
            Got it
          </button>
        </>
      )}
    </ModalShell>
  );
}
