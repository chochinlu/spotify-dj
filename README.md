# Spotify DJ

A TypeScript MCP Server that manages Spotify playlists, discovers new music, and auto-updates on schedule — all through natural conversation in Claude Code.

TypeScript MCP Server，透過 Claude Code 對話式管理 Spotify 播放清單、探索新音樂、自動排程更新。

## Features / 功能

- **Playlist Management / 播放清單管理** — Create, update, delete playlists with natural language (e.g., "Create a rainy day jazz playlist" / 「幫我建一個下雨天的爵士播放清單」)
- **Music Discovery / 探索新音樂** — 3 recommendation strategies: similar artists, curated picks, surprise genres / 三種推薦策略：相似歌手、策展精選、跨界驚喜
- **Listening Analysis / 聽歌分析** — Analyze your listening habits and auto-categorize your music / 分析聽歌習慣，自動分類音樂
- **Smart Scheduling / 智慧排程** — Set up auto-update rules for playlists (checked on startup) / 設定播放清單自動更新規則
- **Preference System / 偏好系統** — Tell the system your preferences in natural language / 用自然語言設定偏好（如「最近不想聽韓語歌」）
- **Dedup / 去重** — Never recommends the same song twice / 推薦過的歌不會重複出現

## Architecture / 架構

```
Claude Code ◄──MCP──► spotify-dj Server ◄──REST──► Spotify API
                            │
                       Local SQLite
                      (preferences, history, schedules)
```

## MCP Tools (12)

| Tool | Description / 說明 |
|---|---|
| `create_playlist` | Create playlist from natural language description / 用自然語言描述建立播放清單 |
| `update_playlist` | Add, remove, or refresh playlist tracks / 新增、移除或重新填充曲目 |
| `list_playlists` | List all managed playlists / 列出所有管理中的播放清單 |
| `delete_playlist` | Delete a playlist / 刪除播放清單 |
| `discover` | Discover new music with 3 strategies / 用三種策略探索新歌 |
| `preview_tracks` | Accept or reject recommended tracks / 接受或拒絕推薦曲目 |
| `analyze_listening` | Analyze listening history / 分析聽歌紀錄 |
| `set_preference` | Set preferences in natural language / 用自然語言設定偏好 |
| `smart_categorize` | Auto-categorize music by genre/language / 根據曲風和語言自動分類 |
| `schedule_update` | Set up auto-update schedule / 設定自動更新排程 |
| `list_schedules` | List all schedules / 列出所有排程 |
| `run_now` | Manually trigger a schedule / 手動觸發排程 |

## Prerequisites / 前置需求

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- Spotify Premium account / Spotify Premium 帳號
- Spotify Developer App ([Dashboard](https://developer.spotify.com/dashboard))

## Setup / 安裝

### 1. Clone and build / 下載並編譯

```bash
git clone https://github.com/chochinlu/spotify-dj.git
cd spotify-dj
npm install
npm run build
```

### 2. Create Spotify Developer App / 建立 Spotify 開發者 App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new App, select **Web API**
3. Set Redirect URI to `http://127.0.0.1:8888/callback`
4. Add your Spotify account email to **User Management**
5. Copy Client ID and Client Secret

### 3. Add MCP config to Claude Code / 設定 Claude Code MCP

```bash
claude mcp add \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_SECRET=your_client_secret \
  spotify-dj -- node /path/to/spotify-dj/dist/index.js
```

### 4. First-time auth / 首次授權

On first launch, the server will open your browser for Spotify OAuth authorization. In WSL, you may need to manually open the authorization URL and paste back the `code` parameter.

首次啟動時會開瀏覽器進行 Spotify OAuth 授權。在 WSL 環境下，可能需要手動開啟授權 URL 並貼回 authorization code。

### 5. Restart Claude Code / 重啟 Claude Code

## Usage / 使用方式

Just talk to Claude Code naturally / 直接用自然語言跟 Claude Code 對話：

```
> 分析我的聽歌紀錄
> 幫我建一個適合工作專注的播放清單
> 推薦一些新歌給我
> 每週一自動更新我的探索清單
> 我最近不太想聽韓語歌
```

## Tech Stack / 技術棧

- TypeScript
- `@modelcontextprotocol/sdk` — MCP Server
- `better-sqlite3` — Local state persistence
- `cron-parser` — Schedule evaluation
- `zod` — Input validation
- `vitest` — Testing (48 tests)

## Development / 開發

```bash
npm run test        # Run tests / 執行測試
npm run test:watch  # Watch mode
npm run build       # Build / 編譯
npm run dev         # Watch build / 監視編譯
```

## Project Structure / 專案結構

```
src/
├── index.ts              # MCP Server entry point
├── types.ts              # Shared types
├── spotify/
│   ├── auth.ts           # OAuth flow + token management
│   ├── client.ts         # Spotify REST API client (14 methods)
│   └── api-probe.ts      # API availability detection
├── db/
│   ├── schema.ts         # SQLite DDL (6 tables)
│   ├── connection.ts     # DB singleton
│   ├── playlists.ts      # Playlist CRUD
│   ├── tracks.ts         # Track upsert
│   ├── recommendations.ts # Dedup history
│   ├── preferences.ts    # User preferences
│   └── schedules.ts      # Schedule + cron evaluation
├── recommender/
│   ├── similar.ts        # Related artists + search fallback
│   ├── curated.ts        # Featured playlists + new releases
│   ├── surprise.ts       # Cross-genre discovery
│   └── engine.ts         # Strategy orchestrator (60/30/10 mix)
├── scheduler/
│   └── checker.ts        # Startup due-check
└── tools/                # 12 MCP tool handlers
```

## License

ISC
