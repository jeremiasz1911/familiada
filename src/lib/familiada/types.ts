export type GameDoc = {
  title: string;
  ownerUid: string;
  status: "setup" | "live" | "ended";
  createdAt: any;
  updatedAt: any;
};

export type TeamDoc = {
  name: string;
  members: string[];
  score: number;
  createdAt: any;
};

export type RoundDoc = {
  index: number;
  title: string;
  multiplier: number; // 1,2,3
  type: "normal" | "final";
  createdAt: any;
};

export type Answer = { text: string; points: number; variants?: string[] };

export type QuestionDoc = {
  index: number;
  text: string;
  timeLimitSec: number;
  answers: Answer[];
  createdAt: any;
};

export type LiveStateDoc = {
  currentRoundId: string | null;
  currentQuestionId: string | null;
  revealedIdx: number[];
  strikesByTeam: Record<string, number>;
  timer: {
    running: boolean;
    startedAt: any | null; // Firestore Timestamp
    durationSec: number;
  };
  timerEnabled?: boolean;     // default false
  activeTeamId?: string | null; // która drużyna teraz odpowiada (dla X)
  steal: {
    enabled: boolean;
    teamId: string | null; // kto przejmuje
  };
  sfx?: {
    name: "reveal" | "wrong" | "intro" | "win" | "won" | null;
    at: any | null; // serverTimestamp
  };
  lastAward?: {
    teamId: string;
    points: number;
    at: any | null; // serverTimestamp
  } | null;

  lastStrike?: {
    teamId: string;
    prev: number;
    next: number;
    at: any | null;
  } | null;
  overlay?: {
    type: "round";
    text: string;        // np. "RUNDA II"
    at: any | null;      // serverTimestamp
    durationMs: number;  // np. 2500
  } | null;
  final?: LiveFinalState;
};
export type FinalPlayerDoc = {
  name: string;
  index: number;
  score: number;
  createdAt?: any;
  updatedAt?: any;
};

export type FinalQuestionDoc = {
  text: string;
  index: number;
  timeLimitSec?: number;
  answers: Array<{ text: string; points: number }>;
  createdAt?: any;
  updatedAt?: any;
};

export type FinalResponseDoc = {
  questionId: string;
  questionIndex: number;
  playerId: string;
  playerName: string;
  playerIndex: number;

  inputText: string;     // co powiedział uczestnik
  answerIndex: number;   // którą odpowiedź “przypisał” prowadzący
  points: number;

  revealed: boolean;     // czy punkty są odkryte na TV

  createdAt?: any;
  updatedAt?: any;
};

export type LiveFinalState = {
  enabled: boolean;
  questionId: string | null;
  activePlayerId: string | null;
  usedByQuestion: Record<string, number[]>;
};

/// w LiveStateDoc dopisz:
/// final?: LiveFinalState;