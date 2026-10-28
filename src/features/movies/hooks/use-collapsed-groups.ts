import { useCallback, useState } from "react";
import type { GroupKey } from "../types";

type CollapseState = {
  grouping?: GroupKey;
  /** Set by "Collapse all", so groups that appear later (e.g. after a filter change) start collapsed too. */
  allCollapsed: boolean;
  /** Groups toggled away from `allCollapsed`. */
  exceptions: Set<string>;
};

const expanded = (grouping: GroupKey | undefined): CollapseState => ({
  grouping,
  allCollapsed: false,
  exceptions: new Set(),
});

/** Which group sections are collapsed; cleared when the grouping changes, since keys differ per grouping. */
export function useCollapsedGroups(grouping: GroupKey | undefined) {
  const [state, setState] = useState(() => expanded(grouping));
  // Reset during render rather than in an effect, so the old grouping's keys never paint.
  if (state.grouping !== grouping) setState(expanded(grouping));

  const toggle = useCallback(
    (key: string) =>
      setState((prev) => {
        const exceptions = new Set(prev.exceptions);
        if (!exceptions.delete(key)) exceptions.add(key);
        return { ...prev, exceptions };
      }),
    [],
  );
  const setAll = useCallback(
    (collapse: boolean) => setState((prev) => ({ ...prev, allCollapsed: collapse, exceptions: new Set() })),
    [],
  );
  const isCollapsed = (key: string) => state.allCollapsed !== state.exceptions.has(key);

  return { isCollapsed, toggle, setAll };
}
