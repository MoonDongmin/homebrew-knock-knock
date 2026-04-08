import type { Locale } from "./types";

const translations = {
	// ── Calibration ──
	"cal.baseline": { en: "Baseline", ko: "기준값 측정" },
	"cal.baseline.desc": {
		en: "Place your MacBook on a flat, stable surface. Keep it still during measurement.",
		ko: "MacBook을 평평하고 안정적인 곳에 놓아주세요. 측정 중에는 움직이지 마세요.",
	},
	"cal.baseline.start": {
		en: "Start Baseline Measurement",
		ko: "기준값 측정 시작",
	},
	"cal.baseline.measuring": { en: "Measuring...", ko: "측정 중..." },
	"cal.baseline.holdStill": { en: "Hold still.", ko: "가만히 있어주세요." },
	"cal.knockTest": { en: "{n}-Knock Test", ko: "{n}번 노크 테스트" },
	"cal.knockTest.desc": {
		en: "Tap your desk {n} {unit} after pressing the button below.",
		ko: "아래 버튼을 누른 후 책상을 {n}번 두드려주세요.",
	},
	"cal.knockTest.timeUnit": { en: "time", ko: "번" },
	"cal.knockTest.timesUnit": { en: "times", ko: "번" },
	"cal.sensitivity": { en: "Sensitivity", ko: "감도" },
	"cal.moreSensitive": { en: "More sensitive", ko: "더 민감하게" },
	"cal.lessSensitive": { en: "Less sensitive", ko: "덜 민감하게" },
	"cal.ready": { en: "Ready — Start Listening", ko: "준비 완료 — 듣기 시작" },
	"cal.startSensitivity": {
		en: "Ready — Start Sensitivity Setup",
		ko: "준비 완료 — 감도 설정 시작",
	},
	"cal.autoAdvancing": {
		en: "Moving to next...",
		ko: "다음 단계로 이동 중...",
	},
	"cal.knockNow": {
		en: "Knock {n} {unit} now!",
		ko: "지금 {n}번 노크하세요!",
	},
	"cal.listening": { en: "Listening...", ko: "듣는 중..." },
	"cal.waitingForKnocks": {
		en: "Waiting for knocks...",
		ko: "노크를 기다리는 중...",
	},
	"cal.detected": {
		en: "{n}-Knock Detected!",
		ko: "{n}번 노크 감지!",
	},
	"cal.doesMatch": {
		en: "Does this match what you did?",
		ko: "방금 하신 것과 맞나요?",
	},
	"cal.noRetry": { en: "No, retry", ko: "아니요, 다시" },
	"cal.yesCorrect": { en: "Yes, correct!", ko: "네, 맞아요!" },
	"cal.noKnockDetected": {
		en: "No knock detected",
		ko: "노크가 감지되지 않았습니다",
	},
	"cal.detectedWrong": {
		en: "Detected {detected} instead of {expected}",
		ko: "{expected}번이 아닌 {detected}번이 감지되었습니다",
	},
	"cal.tryHarder": {
		en: "Try tapping harder, or adjust sensitivity.",
		ko: "더 세게 두드려보거나 감도를 조절해보세요.",
	},
	"cal.needsAdjust": {
		en: "The sensitivity may need adjustment.",
		ko: "감도 조절이 필요할 수 있습니다.",
	},
	"cal.retrySame": { en: "Retry same settings", ko: "같은 설정으로 다시" },
	"cal.cancel": { en: "Cancel", ko: "취소" },
	"cal.backToHome": { en: "Back to Home", ko: "홈으로 돌아가기" },
	"cal.complete": { en: "Calibration Complete!", ko: "캘리브레이션 완료!" },
	"cal.complete.desc": {
		en: "All knock patterns verified successfully. KnockKnock is ready.",
		ko: "모든 노크 패턴이 확인되었습니다. KnockKnock이 준비되었습니다.",
	},
	"cal.tapThreshold": { en: "Tap threshold", ko: "탭 임계값" },
	"cal.verifiedPatterns": { en: "Verified patterns", ko: "확인된 패턴" },
	"cal.knock": { en: "{n}-knock", ko: "{n}번 노크" },
	"cal.getStarted": { en: "Get Started", ko: "시작하기" },
	"cal.tapIntensity": { en: "Tap Intensity", ko: "탭 강도" },
	"cal.liveCount": {
		en: "{current} / {target} detected",
		ko: "{current} / {target} 감지됨",
	},
	"cal.lastResult": {
		en: "Last: {n}-knock detected",
		ko: "마지막: {n}번 노크 감지",
	},
	"cal.lastResultWrong": {
		en: "Last: detected {detected} instead of {expected} — adjust sensitivity",
		ko: "마지막: {expected}번이 아닌 {detected}번 감지 — 감도를 조절해보세요",
	},
	"cal.confirmWhenReady": {
		en: "When sensitivity feels right, press confirm",
		ko: "감도가 마음에 들면 확인을 눌러주세요",
	},
	"cal.confirmSensitivity": {
		en: "Yes, correct!",
		ko: "네, 맞아요!",
	},

	// ── Settings Panel ──
	"settings.patterns": { en: "Patterns", ko: "패턴" },
	"settings.sensitivity": { en: "Sensitivity", ko: "감도" },
	"settings.sound": { en: "Sound", ko: "소리" },
	"settings.about": { en: "About", ko: "정보" },
	"settings.monitoring": { en: "Monitoring", ko: "모니터링" },
	"settings.monitoringOn": { en: "On", ko: "켜짐" },
	"settings.monitoringOff": { en: "Off", ko: "꺼짐" },
	"settings.language": { en: "Language", ko: "언어" },
	"settings.recalibrate": { en: "Recalibrate", ko: "감도 재설정" },
	"settings.launchAtLogin": { en: "Launch at login", ko: "로그인 시 실행" },

	// ── Sensitivity ──
	"sensitivity.title": { en: "Sensitivity", ko: "감도" },
	"sensitivity.desc": {
		en: "Adjust how easily desk taps are detected. Higher sensitivity means lighter taps will be registered.",
		ko: "책상 탭 감지 민감도를 조절합니다. 감도가 높을수록 가벼운 탭도 인식됩니다.",
	},
	"sensitivity.low": { en: "Low", ko: "낮음" },
	"sensitivity.default": { en: "Default", ko: "기본" },
	"sensitivity.high": { en: "High", ko: "높음" },
	"sensitivity.current": { en: "Current sensitivity", ko: "현재 감도" },
	"sensitivity.effective": { en: "Effective threshold", ko: "적용 임계값" },
	"sensitivity.easier": { en: "Easier to trigger", ko: "쉽게 감지" },
	"sensitivity.harder": { en: "Harder to trigger", ko: "어렵게 감지" },
	"sensitivity.liveTest": { en: "Live Test", ko: "실시간 테스트" },
	"sensitivity.listening": { en: "Listening", ko: "감지 중" },
	"sensitivity.paused": { en: "Paused", ko: "일시정지" },
	"sensitivity.detecting": {
		en: "Detecting... {n} tap(s) so far",
		ko: "감지 중... 현재 {n}번",
	},
	"sensitivity.detected": {
		en: "{n}-knock detected!",
		ko: "{n}번 노크 감지!",
	},
	"sensitivity.knockToTest": {
		en: "Knock on your desk to test",
		ko: "책상을 노크해서 테스트하세요",
	},
	"sensitivity.enableMonitoring": {
		en: "Enable monitoring to test",
		ko: "모니터링을 켜서 테스트하세요",
	},
	"sensitivity.recentTests": { en: "Recent tests", ko: "최근 테스트" },
	"sensitivity.clear": { en: "Clear", ko: "지우기" },
	"sensitivity.nKnocks": { en: "{n}-knock", ko: "{n}번 노크" },
	"sensitivity.needsCalibration": {
		en: "Please set up sensitivity first",
		ko: "먼저 감도 설정을 해주세요",
	},
	"sensitivity.needsCalibrationDesc": {
		en: "Run calibration to start detecting knocks.",
		ko: "노크 감지를 시작하려면 감도 설정을 진행해주세요.",
	},

	// ── Sound ──
	"sound.title": { en: "Sound Feedback", ko: "소리 피드백" },
	"sound.desc": {
		en: "Play a sound when a tap pattern is detected.",
		ko: "탭 패턴이 감지되면 소리를 재생합니다.",
	},
	"sound.enable": { en: "Enable sound feedback", ko: "소리 피드백 활성화" },
	"sound.feedback": { en: "Sound feedback", ko: "소리 피드백" },
	"sound.feedbackSound": { en: "Feedback sound", ko: "피드백 소리" },
	"sound.selectSound": { en: "Sound", ko: "소리 선택" },

	// ── About ──
	"about.version": { en: "Version", ko: "버전" },
	"about.description": {
		en: "Detect desk taps and trigger system actions.",
		ko: "책상 두드리기를 감지하여 시스템 액션을 실행합니다.",
	},
	"about.starHelps": {
		en: "A GitHub star helps the project grow!",
		ko: "GitHub Star는 프로젝트 발전에 큰 도움이 됩니다!",
	},

	// ── Pattern ──
	"pattern.title": { en: "Knock Patterns", ko: "노크 패턴" },
	"pattern.desc": {
		en: "Map desk knock patterns to actions.",
		ko: "책상 노크 패턴에 액션을 연결하세요.",
	},
	"pattern.taps": { en: "{n} knock(s)", ko: "{n}번 노크" },
	"pattern.noAction": { en: "No action assigned", ko: "액션 미지정" },
	"pattern.add": { en: "Add Pattern", ko: "패턴 추가" },
	"pattern.edit": { en: "Edit", ko: "수정" },
	"pattern.delete": { en: "Delete", ko: "삭제" },
	"pattern.selectAction": { en: "Select action", ko: "액션 선택" },
	"pattern.knockCount": { en: "Knock Count", ko: "노크 횟수" },
	"pattern.action": { en: "Action", ko: "액션" },
	"pattern.enabled": { en: "Enabled", ko: "활성화" },
	"pattern.newPattern": { en: "New Pattern", ko: "새 패턴" },
	"pattern.editPattern": { en: "Edit Pattern", ko: "패턴 수정" },
	"pattern.newDesc": {
		en: "Create a new knock pattern and assign an action.",
		ko: "새 노크 패턴을 만들고 액션을 연결하세요.",
	},
	"pattern.editDesc": {
		en: "Modify this knock pattern mapping.",
		ko: "이 노크 패턴 매핑을 수정합니다.",
	},
	"pattern.chooseAction": {
		en: "Choose an action...",
		ko: "액션을 선택하세요...",
	},
	"pattern.cancel": { en: "Cancel", ko: "취소" },
	"pattern.save": { en: "Save", ko: "저장" },
	"pattern.empty": {
		en: "No patterns configured yet.",
		ko: "아직 설정된 패턴이 없습니다.",
	},
	"pattern.emptyHint": {
		en: "Add a pattern to get started.",
		ko: "패턴을 추가해서 시작하세요.",
	},

	// ── Action Picker ──
	"action.chooseAction": { en: "Choose Action", ko: "액션 선택" },
	"action.searchActions": { en: "Search actions...", ko: "액션 검색..." },
	"action.noResults": {
		en: "No actions match your search.",
		ko: "검색 결과가 없습니다.",
	},
	"action.browseApps": { en: "Browse Apps...", ko: "앱 찾아보기..." },
	"action.openApp": { en: "Open {name}", ko: "{name} 열기" },
	"action.selectFromFinder": {
		en: "Select from Finder...",
		ko: "Finder에서 선택...",
	},
	"action.categoryAppLaunch": { en: "App Launch", ko: "앱 실행" },
	"action.categoryMedia": { en: "Media", ko: "미디어" },
	"action.categoryVoice": { en: "Voice", ko: "음성" },

	// ── Trial ──
	"trial.daysLeft": { en: "{n} days left in trial", ko: "체험판 {n}일 남음" },
	"trial.expired": { en: "Trial expired", ko: "체험판 만료" },
	"trial.purchase": { en: "Purchase", ko: "구매하기" },

	// ── Purchase ──
	"purchase.title": { en: "Upgrade to Pro", ko: "Pro로 업그레이드" },
	"purchase.desc": {
		en: "Your trial has expired. Purchase a license to continue using KnockKnock.",
		ko: "체험판이 만료되었습니다. 계속 사용하려면 라이선스를 구매하세요.",
	},
	"purchase.activate": { en: "Activate License", ko: "라이선스 활성화" },
	"purchase.enterKey": { en: "Enter license key", ko: "라이선스 키 입력" },

	// ── Errors ──
	"error.accel": {
		en: "Accelerometer error: {msg}",
		ko: "가속도계 오류: {msg}",
	},

	// ── Common ──
	"common.loading": { en: "Loading...", ko: "로딩 중..." },
	"common.remaining": { en: "remaining", ko: "남음" },
} as const;

export type TranslationKey = keyof typeof translations;

/**
 * Get a translated string. Supports interpolation with {key} syntax.
 *
 * @example t("cal.knockTest", "ko", { n: 2 }) → "2번 노크 테스트"
 */
export function t(
	key: TranslationKey,
	locale: Locale,
	params?: Record<string, string | number>,
): string {
	const entry = translations[key];
	let text: string = entry[locale] ?? entry.en;

	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replaceAll(`{${k}}`, String(v));
		}
	}

	return text;
}
