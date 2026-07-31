# Map Notes Management

This document is the human-readable index for map notes in the site.

Runtime data files:

- City map library: `static/data/maps/map-library.json`
- Default marker notes: `static/data/maps/map-notes.json`
- Built-in Fuzhou map image: `static/map/images/fuzhou.jpeg`

The website also saves edits in browser `localStorage`. To publish edited notes permanently, export `map-notes.json` from the website and replace `static/data/maps/map-notes.json`.

## City: 福州

Map ID: `fuzhou`

Map image: `static/map/images/fuzhou.jpeg`

Notes file: `static/data/maps/map-notes.json`

| Marker | Position | Article Summary | Note ID |
| --- | --- | --- | --- |
| 西湖公园 | `x: 43.93%`, `y: 18.24%` | 好玩，有很多小动物 | `note-1785476330067-444` |
| 免费运动场 | `x: 15.89%`, `y: 46.79%` | 定时免费 | `note-1785476356027-629` |
| 三坊七巷 | `x: 46.59%`, `y: 24.39%` | 榕树 | `note-1785476429089-182` |
| 乌龙江湿地公园 | `x: 26.20%`, `y: 57.17%` | 还行，跑道很长 | `note-1785476522863-989` |
| 旗山湖公园 | `x: 8.88%`, `y: 49.42%` | 逛了一圈 | `note-1785476597952-918` |

## Note Data Shape

Each marker in `static/data/maps/map-notes.json` uses this shape:

```json
{
  "id": "note-...",
  "mapId": "fuzhou",
  "x": 43.93,
  "y": 18.24,
  "title": "西湖公园",
  "body": "好玩，有很多小动物\n\n",
  "updatedAt": 1785476346625
}
```

Field guide:

- `id`: stable marker ID. Keep it unchanged when editing existing notes.
- `mapId`: city map ID. It must match a city in `static/data/maps/map-library.json`.
- `x`: horizontal position on the map image, in percent from left to right.
- `y`: vertical position on the map image, in percent from top to bottom.
- `title`: marker name shown in the website list.
- `body`: Markdown article content for the marker.
- `updatedAt`: update timestamp in milliseconds.

## Adding Another City In Code

1. Put the city map image under `static/map/images/`, for example `static/map/images/beijing.svg` or `static/map/images/beijing.jpeg`.
2. Add a city entry to `static/data/maps/map-library.json`.
3. Add marker notes to `static/data/maps/map-notes.json` with the same `mapId`.
4. Update this document with a new city section and marker table.
