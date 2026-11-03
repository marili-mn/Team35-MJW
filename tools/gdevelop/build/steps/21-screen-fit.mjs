// Step 21 — The game keeps its 1280x720 view whatever the shape of the window. It used to adapt its width to
// the window, so a window wider than 16:9 showed more than the art covers: past the edges of a level and
// around the menus the scene's near-white background showed as blank bars. Now the view stays 16:9 inside
// black bars (letterboxing, like any game in a window) and every scene's background is the night color of
// the art, so nothing uncovered ever shows white.
const NIGHT = [18, 10, 32];

export default function screenFit({ project }) {
  project.setSizeOnStartupMode("");
  project.setAdaptGameResolutionAtRuntime(false);
  for (let i = 0; i < project.getLayoutsCount(); i++) project.getLayoutAt(i).setBackgroundColor(...NIGHT);
  return `fixed ${project.getGameResolutionWidth()}x${project.getGameResolutionHeight()} view inside black bars, night background in ${project.getLayoutsCount()} scenes`;
}
