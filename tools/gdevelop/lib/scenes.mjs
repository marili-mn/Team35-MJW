// The game's scenes by role, in one place (the build steps used to repeat these lists).
export const LEVEL_SCENES = ["Nivel1", "Nivel2", "Nivel3"];      // the story levels, with a portal at the end
export const SURVIVAL_SCENE = "Supervivencia";                   // the hidden endless level, unlocked by winning
export const LEVEL_SELECT_SCENE = "Niveles";
// Scenes where Kaito is played: they all get the same feel, pause, jump, moves and gravity rules.
export const PLAYABLE = ["Tutorial", ...LEVEL_SCENES, SURVIVAL_SCENE];
