import { useMemo } from "react";

import { useAuth } from "./auth-context";
import { useHearthLayout, type HearthLayout, type Scope } from "./hearth";
import { copyPhotos } from "./hearth-photos";
import { homePhotoFolder, mapFramePhotos, planPhotoMoves, splitHomeChanges, withHomePage } from "./home-hearth";
import { useHomeHearth } from "./home-hearth-data";

// The Hearth as the screens see it: your own pages, plus the Home page
// shared with everyone in your Home (CORE-054) once your Home has two or
// more people, unless you've hidden it. `save` sends each part of a change
// where it belongs. Inside a Hollow (`scope`) it's just your own Hearth.
export function useHearthView(scope: Scope = null) {
  const personal = useHearthLayout();
  const home = useHomeHearth();
  const { session } = useAuth();
  const userId = session?.user.id;

  const showsHome = !scope && home.available && !personal.layout.hideHomePage;
  const onHome = showsHome && home.onHomePage;
  const homeHearth = useMemo(() => ({ items: home.items, name: home.name }), [home.items, home.name]);
  const layout = useMemo(
    () => (showsHome ? withHomePage(personal.layout, homeHearth, onHome) : personal.layout),
    [showsHome, onHome, personal.layout, homeHearth]
  );

  // `later`: only your own part waits a moment before it's sent (page
  // swipes, CORE-104); anything for the Home page goes straight away.
  async function save(changes: Partial<HearthLayout>, options?: { later?: boolean }) {
    if (!showsHome) return personal.save(changes, options);
    const split = splitHomeChanges(personal.layout, homeHearth, onHome, changes);
    home.setOnHomePage(split.onHome);
    let homeItems = split.homeItems;
    let mine = split.personal;

    // A photo frame moving onto the Home page takes copies of its pictures
    // to the Home's folder, so everyone there can see them; moving off, it
    // takes copies back to yours.
    const copies: { from: string; to: string }[] = [];
    if (homeItems && home.homeId) {
      const plan = planPhotoMoves(homeItems, homePhotoFolder(home.homeId));
      homeItems = plan.items;
      copies.push(...plan.copies);
    }
    if (mine && userId && (mine.items || mine.otherPages)) {
      const next = { ...mine };
      if (mine.items) {
        const plan = planPhotoMoves(mine.items, userId);
        next.items = plan.items;
        copies.push(...plan.copies);
      }
      if (mine.otherPages) {
        next.otherPages = {};
        for (const [id, items] of Object.entries(mine.otherPages)) {
          const plan = planPhotoMoves(items, userId);
          next.otherPages[id] = plan.items;
          copies.push(...plan.copies);
        }
      }
      mine = next;
    }
    if (copies.length) {
      const failed = await copyPhotos(copies);
      if (failed.size) {
        // Couldn't copy: keep pointing at the original.
        const back = new Map(copies.map((c) => [c.to, c.from]));
        const undo = (path: string) => (failed.has(path) ? back.get(path) ?? path : path);
        if (homeItems) homeItems = mapFramePhotos(homeItems, undo);
        if (mine?.items) mine = { ...mine, items: mapFramePhotos(mine.items, undo) };
        if (mine?.otherPages) {
          const pages: HearthLayout["otherPages"] = {};
          for (const [id, items] of Object.entries(mine.otherPages)) pages[id] = mapFramePhotos(items, undo);
          mine = { ...mine, otherPages: pages };
        }
      }
    }

    await Promise.all([
      mine ? personal.save(mine, options) : null,
      homeItems ? home.saveItems(homeItems) : null,
      split.homeName !== null ? home.rename(split.homeName) : null,
    ]);
  }

  return {
    layout,
    save,
    isLoading: personal.isLoading,
    error: personal.error,
    reload: personal.reload,
    // Your own Hearth, for things that are only ever yours (Scenes).
    personal,
    home,
    showsHome,
    onHome,
  };
}
