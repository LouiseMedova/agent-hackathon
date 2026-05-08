# Agent Arcade Skills

Agent Arcade is an Open / Creative Vara hackathon application. It exposes a
small Sails service that lets wallets submit a browser-game run score and query a
public leaderboard.

## Consumer Use Cases

- Call `AgentArcade/SubmitScore(score, tasks_completed, threats_dodged)` after a
  completed game run to commit the player's best score.
- Call `AgentArcade/Leaderboard(limit)` to render public rankings.
- Call `AgentArcade/PlayerBestScore(player)` or `AgentArcade/PlayerRank(player)`
  to inspect a wallet's standing.

## Contract

- Program ID: `0xa4d1c74aa2069f0bbee77e0bf4766bdda6e987eefa13f64113eecd2ff5b05dde`
- Network: Vara testnet
- IDL: `agent_arcade_client.idl`

## Scoring

Only improved scores overwrite stored state. A lower score is accepted as a
completed run response but does not update the leaderboard. The program emits
`BestScoreUpdated` only when a wallet improves its personal best.
