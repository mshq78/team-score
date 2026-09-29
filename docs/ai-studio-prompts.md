# پرامپت‌های Google AI Studio — سامانه یکپارچه یارکشی + امتیازدهی

> متن خود پرامپت‌ها (داخل کادرها) انگلیسی است تا AI Studio دقیق‌تر بفهمد. توضیحات و چک‌لیست‌ها برای شما فارسی مانده است. متن‌های رابط کاربری که داخل «» آمده‌اند عیناً فارسی در اپ نمایش داده می‌شوند.

## تقسیم کار

| کار | انجام‌دهنده |
|---|---|
| رابط کاربری، فرم‌ها، جدول‌ها، انیمیشن‌ها، صفحه پروژکتور (کارهای حجیم و توکن‌سوز) | **AI Studio** با پرامپت‌های زیر |
| سرور محلی روی لپ‌تاپ + همگام‌سازی گوشی داورها از طریق هات‌اسپات (بدون اینترنت) | **Claude** |
| PWA و نصب آفلاین، QR کد داورها، تعدیل داورهای سخت‌گیر/دست‌ودل‌باز، رأی تیم‌ها به هم، تست‌ها، دیباگ | **Claude** |

## نحوه استفاده

1. پرامپت‌ها را **به ترتیب** و **هر بار فقط یکی** به AI Studio بدهید. اول مرحله قبلی را تست کنید، بعد سراغ بعدی بروید.
2. بعد از هر مرحله، چک‌لیست «تست دستی» زیر همان پرامپت را روی پیش‌نمایش امتحان کنید. اگر چیزی خراب بود، همان‌جا به AI Studio بگویید درستش کند.
3. بعد از هر مرحله کد را در GitHub روی **یک شاخه جدا** ذخیره کنید، مثلاً `ai-studio/step-1`، نه روی `main`. بعد به Claude بگویید تا بررسی و دیباگ کند.
4. اگر AI Studio وسط کار قطع شد یا نصفه نوشت، بنویسید:
   `Continue exactly where you stopped. Do not rewrite files you already finished.`

---

## پرامپت ۱ — پایه: آفلاین، رفع باگ‌ها، لایه داده

```text
This project is a Persian (RTL) React + Vite + Tailwind app for a live team draft ("یارکشی") at a bootcamp. Over several steps it will become one unified "team draft + team scoring" system. THIS STEP IS FOUNDATION ONLY — do not add any scoring features yet.

GLOBAL RULES (apply to this and every later step):
- The app must work 100% offline. No network requests, no CDNs, no Google Fonts, no external APIs.
- Do not use the Gemini API or any AI/backend. Do not create a server.
- All user-facing text must be in Persian. Displayed numbers must use the existing toPersianDigits helper.
- TypeScript strict; never use `any`.
- All existing draft features (drag & drop, random auto-fill, SMS generator, simple/advanced modes, themes, display sizes) must keep working exactly as before.
- Do not rewrite existing components unless needed; change only what is required.

TASKS:

1) Offline font
- Remove the Google Fonts <link> tags from index.html.
- Add the @fontsource/vazirmatn package and import weights 400, 500, 700, 800, 900 in src/main.tsx.

2) Cleanup
- Remove the unused packages @google/genai, express, @types/express and dotenv from package.json.
- Rename the package to "teamkeshi".
- Delete .env.example.

3) Centralized data layer (VERY IMPORTANT — later steps and a future network sync layer will build on this)
- Create src/store/.
- src/store/state.ts: an `AppState` interface containing ALL persisted data (participants, teams, draftLog, settings) plus `schemaVersion: number`.
- src/store/actions.ts: an `AppAction` discriminated union for every data mutation, e.g. ASSIGN_TO_TEAM, REMOVE_MEMBER, RETURN_TO_HALL, PROMOTE_LEADER, AUTO_FILL, UPDATE_TEAM, SET_TEAMS_COUNT, RESET_DRAFT, RESET_ALL, ADD_PARTICIPANTS, REMOVE_PARTICIPANT, REPLACE_PARTICIPANTS, UPDATE_PARTICIPANT, IMPORT_BACKUP.
- src/store/reducer.ts: a PURE reducer (state, action) => state.
  - No side effects inside it: no sounds, toasts or confetti.
  - IDs, timestamps and random values must come in via the action payload. Never call Date.now() or Math.random() inside the reducer. (AUTO_FILL should receive the already-shuffled assignment in its payload.)
- src/store/persistence.ts: loadState() and saveState(state) using localStorage key "teamkeshi_state_v3", wrapped in try/catch. If the old keys (bootcamp_live_participants_v2, bootcamp_live_teams_v2, bootcamp_live_settings_v2) exist, migrate them once into the new format.
- src/store/useAppStore.ts: a hook that initializes useReducer from loadState(), calls saveState on every change, and returns { state, dispatch }.
- Refactor App.tsx to use this store instead of separate useState calls. Sounds, toasts and confetti are triggered in App/components after dispatching.

4) Bug fixes
a) Leader phone
- Remove `leaderPhone` from BootcampTeam. A phone number lives only on Participant.phone.
- The leader is always the first member, and the leader's phone is that person's phone.
- In SmsModal, editing the phone must dispatch UPDATE_PARTICIPANT for the current leader. When the leader changes, the displayed phone must change with them.
- Migration: if an old team had leaderPhone and its leader has no phone, move it onto the leader's phone.

b) Orphaned members
- Teams must store only member IDs (`memberIds: string[]`). Full participant data is always read from `participants`, so editing a name or phone updates everywhere.
- Add a selector getTeamMembers(state, teamId).
- REMOVE_PARTICIPANT and REPLACE_PARTICIPANTS must also remove those people from every team.

c) Bulk paste parsing
- One person per line. Split lines ONLY on newlines, never on commas.
- In each line, find a mobile number with a regex for Iranian mobiles: 09xxxxxxxxx or +989xxxxxxxxx. Accept Persian or Latin digits, and optional spaces or dashes between digits. Normalize the number to Latin digits with no separators.
- The rest of the line, trimmed of leading/trailing separators (- | ، , tab), is the name. Names that contain a hyphen must NOT be split.
- Implement this as a pure function parseParticipantLines(text) in src/utils/parse.ts.

d) Clipboard
- Show «کپی شد» only if navigator.clipboard.writeText actually resolved.
- Otherwise fall back to a hidden textarea + document.execCommand('copy'). If that also fails, show an error message.

e) SMS label
- Change the label «فوق‌فشرده (۱ پیامک = زیر ۷۰ کاراکتر)» to «فوق‌فشرده (کمترین کاراکتر)».

5) Backup
Add a «پشتیبان» menu in the header, next to the existing buttons, with two options:
- «دانلود فایل پشتیبان»: download the whole AppState as JSON, named teamkeshi-backup-YYYY-MM-DD-HHmm.json.
- «بازیابی از فایل»: pick a JSON file, validate schemaVersion and structure, then ask for confirmation with an in-app dialog (not window.confirm) before replacing the current state. An invalid or corrupt file must never crash the app.

When done, list every file you created or modified, with one line of explanation per file.
```

**تست دستی مرحله ۱**

- [ ] اینترنت را قطع کنید و صفحه را رفرش کنید: فونت وزیرمتن سالم باشد.
- [ ] چند نفر را یارکشی کنید و صفحه را رفرش کنید: همه‌چیز سر جایش بماند.
- [ ] سرگروه تیم را عوض کنید: در پنجره پیامک، شماره سرگروه جدید نمایش داده شود.
- [ ] یک نفر عضو تیم را از لیست حذف کنید: از تیم هم حذف شود.
- [ ] این سه خط را دسته‌ای اضافه کنید: `علی رضایی - 0912-111-1111`، `مریم حسینی، ۰۹۳۵۱۲۳۴۵۶۷` و `سارا ابراهیمی-نژاد`. باید سه نفر ثبت شوند، با شماره‌های درست و نام سالم.
- [ ] یک فایل پشتیبان دانلود کنید، همه‌چیز را پاک کنید و از فایل بازیابی کنید.

---

## پرامپت ۲ — مدل امتیازدهی و صفحه تنظیمات

```text
STEP 2: add the scoring data model and the scoring setup screen. All GLOBAL RULES from step 1 still apply. Every data change must go through the store (new actions in the reducer).

CONTEXT: After the draft, teams compete in several events — e.g. a morning team game, cooking their own lunch, and a workshop or strategy/thinking game. Each event has several criteria ("indicators"). Several judges score every team on every indicator. At the end, the winning team is announced.

1) New types in types.ts (use EXACTLY this shape — later steps and a sync server depend on it):

type EventStatus = 'upcoming' | 'active' | 'closed';

interface ScoringIndicator { id: string; name: string; maxScore: number; weight: number; order: number; }
- maxScore defaults to 10.
- weight is the relative weight inside its event; default 1.

interface ScoringEvent { id: string; name: string; weight: number; order: number; status: EventStatus; indicators: ScoringIndicator[]; awardTitle?: string; }
- weight is the relative weight of the event in the total; default 1.

interface Judge { id: string; name: string; accessCode: string; eventIds: string[]; }
- accessCode is a random 4-digit code, unique among judges.
- An empty eventIds means the judge may score all events.

interface ScoreEntry { judgeId: string; teamId: string; eventId: string; indicatorId: string; value: number | null; updatedAt: string; }
- updatedAt is an ISO string.

interface ScoreNote { judgeId: string; teamId: string; eventId: string; text: string; updatedAt: string; }

interface ScoreAdjustment { id: string; teamId: string; eventId: string | null; points: number; reason: string; createdAt: string; }
- points can be positive or negative.

interface ScoringSettings { leaderboardFrozen: boolean; frozenSnapshot: TeamStanding[] | null; showJudgeNames: boolean; tieBreak: 'most_event_wins' | 'highest_last_event' | 'manual'; }

Add to AppState:
scoring: { events: ScoringEvent[]; judges: Judge[]; scores: Record<string, ScoreEntry>; notes: Record<string, ScoreNote>; adjustments: ScoreAdjustment[]; settings: ScoringSettings }
- The scores key is exactly `${judgeId}|${teamId}|${indicatorId}`.
- The notes key is `${judgeId}|${teamId}|${eventId}`.
- Bump schemaVersion and add a migration that initializes `scoring` with defaults for old data.

2) Scoring math — a pure module src/scoring/compute.ts (no React)
- computeStandings(state): TeamStanding[] returns, per team: teamId, per-event scores (0–100 or null), total of adjustments, grand total, rank, and judging completion percentage.
- Rules:
  a) For each indicator: the average of value / maxScore over the judges who gave a non-null value.
  b) Event score = weighted average (by indicator weight) of the indicator averages × 100. Indicators with no scores at all are excluded from the average.
  c) Grand total = weighted average (by event weight) of the events that have at least one score, plus the sum of adjustment points.
  d) Rank descending. Break ties according to settings.tieBreak; with 'manual', tied teams share the same rank.
- computeEventWinners(state): the winning team of each 'closed' event.
- Round final displayed numbers to 1 decimal, but compute with full precision.
- Add vitest to devDependencies, a "test": "vitest run" script, and write tests in src/scoring/compute.test.ts covering weights, missing scores, adjustments and ties.

3) App modes
- Extend AppMode to 'simple' | 'advanced' | 'scoring' | 'stage'.
- Add an «امتیازدهی» tab in the header. ('stage' is built in step 4 — only add the type now.)
- The scoring mode has sub-tabs: «تنظیمات»، «ثبت امتیاز»، «امتیاز مجری»، «گزارش». Build only «تنظیمات» in this step; the others are placeholders for now.

4) «تنظیمات» screen
Events:
- Add, rename, change weight, delete (with confirmation), and reorder with up/down buttons.
- Set event status with a 3-state control: «پیش‌رو» / «در جریان» / «بسته‌شده».
- Inside each event, manage its indicators: name, max score and weight.
- Show each event's live share of the total as a percentage (weight / sum of weights) so users understand what weights mean.

Excel import:
- Add an «ورود رویدادها از اکسل» button using the xlsx (SheetJS) package. The format is our existing template:
  - Read the sheet named 01_Events_Indicators, or the first sheet if it doesn't exist.
  - Row 1 is the header.
  - From row 2: column A is the event name, and columns B onward are indicator names.
  - Trim values. Skip fully empty rows. An event with no indicators is an error.
- Show a preview before applying, and let the user choose «جایگزینی» (replace) or «افزودن» (append).
- Add an «دانلود قالب اکسل خام» button that generates that same empty template.

Sample preset:
- Add a «بارگذاری نمونه آماده» button that creates these events:
  - «بازی تیمی صبح»: کار تیمی، سرعت عمل، دقت
  - «آشپزی و ناهار»: طعم، ظاهر و سرو، نظافت و بهداشت، تقسیم کار، رعایت زمان
  - «بازی فکری / کارگاه»: استراتژی، خلاقیت، حل مسئله، مشارکت همه اعضا

Judges:
- Add a judge by name; the accessCode is generated automatically and shown clearly.
- Choose allowed events with checkboxes. Edit and delete judges.
- Deleting a judge who already has scores needs a separate confirmation, and also deletes their scores and notes.

Team removal:
- When the team count is reduced in the draft, also delete that team's scores, notes and adjustments.
- If the team has any scores, warn the user first.

When done, list every file you created or modified.
```

**تست دستی مرحله ۲**

- [ ] نمونه آماده را بارگذاری کنید: سه رویداد با شاخص‌هایشان ساخته شوند.
- [ ] قالب اکسل را دانلود کنید، پر کنید و دوباره وارد کنید.
- [ ] وزن ناهار را ۲ کنید: درصدهای سهم رویدادها درست به‌روز شوند.
- [ ] دو داور بسازید؛ کد ۴ رقمی هر کدام نمایش داده شود.
- [ ] رفرش کنید: همه‌چیز بماند.

---

## پرامپت ۳ — ثبت امتیاز: اپراتور، داور و امتیاز دستی

```text
STEP 3: score entry. All GLOBAL RULES still apply. Every data change goes through store actions.

1) New actions
- SET_SCORE (judgeId, teamId, eventId, indicatorId, value | null, updatedAt), SET_NOTE, ADD_ADJUSTMENT, REMOVE_ADJUSTMENT, SET_EVENT_STATUS and SET_SCORING_SETTINGS.
- Validate in the reducer: value must be an integer from 0 to that indicator's maxScore, or null. Ignore invalid values.
- Add a `source: 'operator' | 'judge'` field to SET_SCORE. Scores for an event whose status is 'closed' may only be changed with source 'operator'.

2) «ثبت امتیاز» — operator score entry (laptop)
- At the top: select the event and select the judge. Entering scores on a judge's behalf is allowed, e.g. when the judge scored on paper.
- A grid: rows are indicators, columns are teams (with team color and name). Each cell is a numeric input.
- Keyboard: Enter/Tab moves to the next cell; arrow keys move between cells, respecting RTL.
- Empty cells have a distinct color. A value above max turns red and is not saved.
- Under each column, show that team's live event score (0–100).
- A progress bar shows what percentage of this judge's cells for this event are filled.
- Also add a «ماتریس تکمیل» view: for the selected event, a judge × team table showing completion % per cell, so the operator can see which judge still has work left.

3) Judge screen (mobile-first)
- If the URL contains ?judge=1, render ONLY the judge login screen instead of the main app: one input for the 4-digit code. On success, keep judgeId in sessionStorage.
- After login:
  - Show the events this judge is allowed to score. Highlight 'active' events; 'closed' events are read-only.
  - Picking an event shows ONE team per screen (team color and name). Move between teams by swiping or with «قبلی» / «بعدی» buttons.
  - For each indicator, show a row of big finger-friendly buttons from 0 to max. If max is greater than 10, use a slider instead.
  - An optional note field per team per event (SET_NOTE).
  - Show a green check on teams this judge has fully scored.
- A judge must NEVER see totals, ranks or other judges' scores.
- Every change is dispatched and saved immediately. There is no "save" button.
- IMPORTANT technical note: for now this screen runs on the same device's localStorage. In a later step, a sync layer between phones and the laptop over the local network will be added. So this screen must use ONLY the store (state + dispatch) and must never read localStorage directly.

4) «امتیاز مجری» — host bonus/penalty
- Big team cards with quick buttons: −5, −2, −1, +1, +2, +5, plus a custom number input.
- Optional link to an event.
- A REQUIRED reason field, with preset chips: «روحیه تیمی»، «تأخیر»، «رعایت نکردن قوانین»، «کمک به تیم دیگر»، «خلاقیت ویژه».
- A history list of adjustments, each removable with confirmation.
- Each entry plays a short sound (existing `sound` helper) and shows a toast.

When done, list every file you created or modified.
```

**تست دستی مرحله ۳**

- [ ] در صفحه اپراتور فقط با کیبورد یک جدول کامل را پر کنید.
- [ ] عدد ۱۵ در شاخصی با حداکثر ۱۰ ذخیره نشود.
- [ ] در یک تب دیگر آدرس `?judge=1` را باز کنید، با کد داور وارد شوید و امتیاز بدهید. (هنوز همان دستگاه است؛ همگام‌سازی بین گوشی‌ها کار Claude است.)
- [ ] یک +۲ «روحیه تیمی» بدهید و در تاریخچه ببینید.

---

## پرامپت ۴ — صحنه: رده‌بندی زنده، قفل، اعلام نتیجه، گزارش

```text
STEP 4: the 'stage' mode for the projector screen, plus the final report. All GLOBAL RULES still apply. Use `motion` (already installed) for animations, and the existing canvas-confetti and `sound` helper. All numbers must come from computeStandings / computeEventWinners — do not duplicate the scoring math.

1) Live leaderboard
- Fullscreen; respects the current displaySize and displayTheme.
- Each team is a horizontal bar in its own color, showing team name, leader name, and grand total in Persian digits. Numbers animate (count up/down) when they change.
- When ranks change, bars move with layout animations. Next to each team, show ▲/▼ for the rank change since the previous state (keep the previous ranking in state).
- Show small per-event score columns for each team; use «—» for events with no scores yet.
- Freeze mode (settings.leaderboardFrozen): when enabled, the stage shows the snapshot taken at the moment of freezing (settings.frozenSnapshot), with a badge «🔒 رده‌بندی تا اعلام نتایج قفل است». New scores do not change the stage while frozen.
- Controls (freeze/unfreeze, go to reveal, exit) sit in a small corner bar that appears on mouse move and hides after 3 seconds. The F key toggles browser fullscreen.

2) Reveal (announcing the results)
- Step by step with Space, the arrow key or a click, from LAST place to FIRST.
- Lower ranks reveal faster. Each of the top 3 reveals with a pause and a drumroll. Add playDrumroll() to sound.ts using Web Audio.
- First place: a big card in the team's color listing all members, multi-burst confetti and playFanfare.
- Optional (a checkbox in settings): before the overall ranking, announce per-event awards one by one — the winner of each closed event with its awardTitle (e.g. «بهترین آشپز»). Add an awardTitle input to the event settings.
- Backspace goes back one step at any point.

3) Rank-over-time chart
- A simple line chart drawn with your own SVG (no chart library) showing each team's rank after each closed event, with each line in the team's color.
- Show it on the stage and in the report.

4) «گزارش» — final report
- A full table: team, members, per-event scores, adjustments total, grand total.
- An expandable detail per team: per-indicator scores broken down by judge, judge notes, and adjustment history.
- A «چاپ / PDF» button using window.print, with @media print styles: white background, no buttons, one team per page as a "team report card".
- An «خروجی اکسل» button using xlsx, with sheets: summary, detailed scores, adjustments.
- A «پیامک نتیجه به سرگروه‌ها» button that reuses the existing SmsModal with a new "result" template producing a short text such as: «تیم X | رتبه ۲ از ۶ | امتیاز ۸۷٫۵ | تبریک!».

When done, list every file you created or modified.
```

**تست دستی مرحله ۴**

- [ ] امتیاز بدهید و پرده رده‌بندی را ببینید: میله‌ها جابه‌جا شوند.
- [ ] رده‌بندی را قفل کنید و امتیاز جدید بدهید: پرده تغییر نکند.
- [ ] اعلام نتیجه را از آخر تا اول با Space جلو ببرید و با Backspace برگردید.
- [ ] چاپ یا PDF بگیرید و خروجی اکسل را دانلود کنید.

---

## کارهایی که بعد از این مراحل Claude انجام می‌دهد

1. بررسی و دیباگ کد هر مرحله، اجرای type-check، بیلد و تست‌ها.
2. **سرور محلی روی لپ‌تاپ:** یک دستور یا فایل اجرایی که اپ را روی شبکه محلی بالا بیاورد، به‌علاوه‌ی همگام‌سازی state بین لپ‌تاپ و گوشی داورها از طریق هات‌اسپات، بدون اینترنت.
3. **صف آفلاین در گوشی داور:** اگر گوشی داور از برد وای‌فای خارج شد، امتیازهایش گم نشوند و بعد همگام شوند. حل تعارض با updatedAt انجام می‌شود.
4. **PWA:** اپ روی لپ‌تاپ و گوشی نصب شود و بدون اینترنت باز شود.
5. **QR کد اختصاصی هر داور** برای چاپ روی کارت.
6. **تعدیل داورها:** اثر داورهای سخت‌گیر و دست‌ودل‌باز متعادل شود، یا دست‌کم امتیاز غیرعادی علامت بخورد.
7. **رأی تیم‌ها به هم** (مثلاً برای ناهار) با QR، بدون امکان رأی به تیم خود.
