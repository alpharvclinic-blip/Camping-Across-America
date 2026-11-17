# Camping Across America

A Vercel-ready interactive map built from the shared Google My Maps snapshot.

## Included in the map

- 5,642 geocoded locations across nine categories.
- The source pin colors are preserved for each category.
- The two original Walmart layers are combined into one category and one toggle.
- Search matches campground/place names, city, state, postal code, and address.
- Category controls filter both the map pins and the sidebar list.
- The imported locations are stored locally in `public/data/locations.json`; no Google Maps API key or account access is needed at runtime.

## Run locally

```bash
npm install
npm run dev
```

Create the production bundle with:

```bash
npm run build
```

## Deploy on Vercel

1. Import this GitHub repository in Vercel.
2. Keep the project root at the repository root.
3. Use the Vite preset, `npm run build` as the build command, and `dist` as the output directory.
4. Deploy. No environment variables are required.

`vercel.json` includes the build and output settings. The map uses OpenStreetMap tiles and displays the required attribution.

## Map data

The data file is a point-in-time import of the public map at:

https://www.google.com/maps/d/u/0/viewer?mid=1AMB5wYCadPjbyFSHz-fttYPKUzDTtHA&usp=sharing

The file preserves each map entry's source attributes and coordinates. Updating the original Google My Maps later does not automatically update this snapshot; re-import the map data to refresh it.
