export const COLORS = {
  y2021: '#e53935',
  y2022: '#fdd835',
  y2026: '#43a047',
} as const;

export const TILE_STYLE = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`;
