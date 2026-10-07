export type SliderState = {
  active: number;
  pending: number | null;
  outgoing: number | null;
  loaded: ReadonlySet<number>;
  failed: ReadonlySet<number>;
  transitionId: number;
  announcement: string;
  pendingAnnouncement: string | null;
};

export type SliderAction =
  | { type: "request"; index: number; total: number; announcement?: string }
  | { type: "loaded"; index: number }
  | { type: "failed"; index: number; total: number }
  | { type: "settled"; transitionId: number }
  | { type: "retry"; index: number; total: number };

export const initialState: SliderState = {
  active: 0,
  pending: null,
  outgoing: null,
  loaded: new Set(),
  failed: new Set(),
  transitionId: 0,
  announcement: "",
  pendingAnnouncement: null,
};

export function nextAvailable(
  current: number,
  direction: number,
  total: number,
  failed: ReadonlySet<number>,
) {
  for (let offset = 1; offset < total; offset += 1) {
    const index = (current + direction * offset + total) % total;
    if (!failed.has(index)) return index;
  }
  return current;
}

function activate(state: SliderState, index: number, announcement: string | null) {
  if (index === state.active) {
    return {
      ...state,
      pending: null,
      pendingAnnouncement: null,
      announcement: announcement ?? state.announcement,
    };
  }
  return {
    ...state,
    active: index,
    pending: null,
    outgoing: state.active,
    transitionId: state.transitionId + 1,
    announcement: announcement ?? state.announcement,
    pendingAnnouncement: null,
  };
}

export function sliderReducer(state: SliderState, action: SliderAction): SliderState {
  switch (action.type) {
    case "retry": {
      if (action.index < 0 || action.index >= action.total) return state;
      const failed = new Set(state.failed);
      const loaded = new Set(state.loaded);
      failed.delete(action.index);
      loaded.delete(action.index);
      return { ...state, failed, loaded, pending: action.index, pendingAnnouncement: null };
    }
    case "request": {
      const { index, total } = action;
      if (index < 0 || index >= total || state.failed.has(index)) return state;
      const prepared =
        index === state.active ||
        index === nextAvailable(state.active, 1, total, state.failed) ||
        index === nextAvailable(state.active, -1, total, state.failed) ||
        index === state.outgoing;
      if (index === state.active || (prepared && state.loaded.has(index))) {
        return activate(state, index, action.announcement ?? null);
      }
      return {
        ...state,
        pending: index,
        pendingAnnouncement: action.announcement ?? null,
      };
    }
    case "loaded": {
      if (state.loaded.has(action.index) && state.pending !== action.index) return state;
      const loaded = new Set(state.loaded).add(action.index);
      const next = { ...state, loaded };
      return state.pending === action.index
        ? activate(next, action.index, state.pendingAnnouncement)
        : next;
    }
    case "failed": {
      if (state.failed.has(action.index)) return state;
      const failed = new Set(state.failed).add(action.index);
      const loaded = new Set(state.loaded);
      loaded.delete(action.index);
      const next = { ...state, failed, loaded };
      if (state.active === action.index) {
        const replacement = nextAvailable(state.active, 1, action.total, failed);
        if (replacement !== state.active && state.loaded.has(replacement)) {
          return activate(next, replacement, null);
        }
        return {
          ...next,
          pending: replacement === state.active ? null : replacement,
          pendingAnnouncement: null,
        };
      }
      if (state.pending === action.index) {
        return { ...next, pending: null, pendingAnnouncement: null };
      }
      return next;
    }
    case "settled":
      return state.transitionId === action.transitionId
        ? { ...state, outgoing: null }
        : state;
  }
}

