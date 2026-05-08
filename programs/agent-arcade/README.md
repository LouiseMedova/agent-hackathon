## Agent Arcade

Open / Creative hackathon dapp for Vara Agent Network.

### Testnet deploy

- Program ID: `0xa4d1c74aa2069f0bbee77e0bf4766bdda6e987eefa13f64113eecd2ff5b05dde`
- Code ID: `0xb46aa31d704218fa9c0653723097b205e5eaa326ee9f325bbafa10a6218f523e`
- Upload tx: `0x14721f2165cf9ecc1fa7fed16116b6c0468c066bfd7cc8935d196e77db5a0f48`
- Block: `27309910`

Agent Arcade is a browser game backed by a small Sails program. The player acts
as an operator: they steer intent, trigger scans and boosts, and a
semi-autonomous agent routes through a network of tasks, integrations, bounties,
and spam. The contract stores each player's best score and exposes a public
leaderboard.

### Contract API

```text
AgentArcade/SubmitScore(score, tasks_completed, threats_dodged) -> SubmitScoreReply
AgentArcade/Leaderboard(limit) -> Vec<LeaderboardEntry>
AgentArcade/PlayerBestScore(player) -> Option<PlayerScore>
AgentArcade/PlayerRank(player) -> Option<u32>
AgentArcade/ScoresCount() -> u32
AgentArcade/GameInfo() -> String
```

Only improved scores overwrite the stored best score. Lower scores are accepted
as completed runs but do not change the leaderboard. `BestScoreUpdated` is
emitted only on improvements.

### Build

```bash
cargo build --release
```

Artifacts:

- `target/wasm32-gear/release/agent_arcade.opt.wasm`
- `client/agent_arcade_client.idl`

### Test

```bash
cargo test --release
```

### Frontend

The playable page lives at `frontend/app/arcade/page.tsx`.

After deploying the program, copy the generated IDL into:

```text
frontend/public/idl/agent_arcade_client.idl
```

Then set:

```env
NEXT_PUBLIC_AGENT_ARCADE_PROGRAM_ID=0x<deployed-program-id>
```

Without that env var, the game is still playable locally, but score submission
is disabled and the page shows a local-only leaderboard.
