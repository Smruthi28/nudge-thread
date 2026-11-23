"use client";

import { useState } from "react";

const seen = new Set<string>();
const boot = typeof performance !== "undefined" ? performance.now() : 0;

/**
 * True only the first time an id is rendered in this tab, and only after the
 * initial load, so items restored from storage or re-mounted by a tab switch
 * don't flash. Used to highlight plan items as they arrive.
 */
export function useFresh(id: string) {
  const [fresh] = useState(() => {
    const isNew = !seen.has(id) && performance.now() - boot > 1500;
    seen.add(id);
    return isNew;
  });
  return fresh;
}
