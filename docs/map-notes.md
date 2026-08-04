# Map Notes Management

This document is the human-readable index for map notes in the site.

Runtime data files:

- City map library: `static/data/maps/map-library.json`
- Default marker notes: `static/data/maps/map-notes.json`
- Built-in map images: `static/map/images/`

The website reads marker notes from `static/data/maps/map-notes.json`. Marker articles are managed in code, not edited in the website UI.

## City: 福州

Map ID: `fuzhou`

Map image: `static/map/images/fuzhou.jpeg`

Notes file: `static/data/maps/map-notes.json`

| Marker | Position | Article Summary | Note ID |
| --- | --- | --- | --- |
| 西湖公园 | `x: 43.93%`, `y: 18.24%` | 好玩，成功抓拍小鹅展翅 | `note-fuzhou-001` |
| 免费运动场 | `x: 15.89%`, `y: 46.79%` | 定时免费 | `note-fuzhou-002` |
| 三坊七巷 | `x: 46.59%`, `y: 24.39%` | 榕树 | `note-fuzhou-003` |
| 乌龙江湿地公园 | `x: 26.20%`, `y: 57.17%` | 还行，跑道很长 | `note-fuzhou-004` |
| 旗山湖公园 | `x: 8.88%`, `y: 49.42%` | 逛了一圈 | `note-fuzhou-005` |
| 国光公园 | `x: 29.88%`, `y: 24.59%` | 很多人拍照 | `note-fuzhou-006` |
| 福道 | `x: 34.92%`, `y: 22.37%` | 下雨凉快，蜿蜒曲折的栈道 | `note-fuzhou-007` |

## City: 上海

Map ID: `shanghai`

Map image: `static/map/images/shanghai.jpeg`

Notes file: `static/data/maps/map-notes.json`

| Marker | Position | Article Summary | Note ID |
| --- | --- | --- | --- |
| 外滩 | `x: 48.24%`, `y: 39.43%` | 做最优质的战士 | `note-shanghai-001` |
| 菜饭骨头汤 | `x: 85.60%`, `y: 66.26%` | 鸡腿饭绝了 | `note-shanghai-002` |
| 松江站 | `x: 18.68%`, `y: 88.55%` | 大 | `note-shanghai-003` |

## City: 南宁

Map ID: `nanning`

Map image: `static/map/images/nanning.jpeg`

Notes file: `static/data/maps/map-notes.json`

| Marker | Position | Article Summary | Note ID |
| --- | --- | --- | --- |
| 三中 | `x: 53.77%`, `y: 56.81%` | 青三 | `note-nanning-001` |
| 邕味老友 | `x: 31.10%`, `y: 46.49%` | 猪杂老友粉值得一试 | `note-nanning-002` |

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
  "previewImage": "static/map/images/fuzhou.jpeg",
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
- `previewImage`: optional small image shown in the marker popup. If omitted, the website uses the first Markdown image in `body`; if no article image exists, it falls back to the city map image.
- `updatedAt`: update timestamp in milliseconds.

## Adding Another City In Code

Only data files need to change. Do not add city-specific HTML in `index.html`; the city tabs are generated from `static/data/maps/map-library.json`.

1. Put the city map image under `static/map/images/`.

Example:

```text
static/map/images/beijing.jpeg
```

2. Add a city entry to `static/data/maps/map-library.json`.

Example:

```json
{
  "id": "beijing",
  "name": "北京",
  "src": "static/map/images/beijing.jpeg",
  "builtin": true,
  "notesFile": "static/data/maps/map-notes.json"
}
```

Important:

- `id` must be unique.
- `id` should use lowercase English letters, numbers, or hyphens.
- `src` must point to the image file under `static/map/images/`.

3. Add marker notes to `static/data/maps/map-notes.json`.

Example:

```json
{
  "id": "note-beijing-001",
  "mapId": "beijing",
  "x": 50,
  "y": 50,
  "title": "示例地点",
  "body": "这里写 Markdown 文章内容。\n\n",
  "previewImage": "static/map/images/beijing-place.jpeg",
  "updatedAt": 1785477000000
}
```

Important:

- `mapId` must exactly match the city `id` in `map-library.json`.
- `x` and `y` are percentages on that map image.
- Keep `id` stable after a note is published.

4. Update this document with a new city section and marker table.

Use this template:

```md
## City: 北京

Map ID: `beijing`

Map image: `static/map/images/beijing.jpeg`

Notes file: `static/data/maps/map-notes.json`

| Marker | Position | Article Summary | Note ID |
| --- | --- | --- | --- |
| 示例地点 | `x: 50.00%`, `y: 50.00%` | 这里写摘要 | `note-beijing-001` |
```

## Adding A Marker To An Existing City

1. Find the target city `id` in `static/data/maps/map-library.json`.
2. Add a new note object to `static/data/maps/map-notes.json`.
3. Set the note's `mapId` to that city `id`.
4. Set `x` and `y` from the website export, or estimate them as image percentages.
5. Write the article in `body`. Markdown image syntax is supported, for example `![照片](static/map/articles/bund-night.jpeg)`.
6. Add `previewImage` if you want the popup thumbnail to use a specific image.
7. Add the marker row to this document.

For example, adding a new Shanghai marker must use:

```json
"mapId": "shanghai"
```

because Shanghai's city entry uses:

```json
"id": "shanghai"
```
