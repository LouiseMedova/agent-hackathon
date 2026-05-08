#![no_std]

extern crate alloc;

use alloc::{string::String, vec::Vec};
use sails_rs::{
    cell::RefCell,
    collections::BTreeMap,
    gstd::{exec, msg},
    prelude::*,
};

const MAX_SCORE: u32 = 1_000_000;
const MAX_TASKS_COMPLETED: u32 = 10_000;
const MAX_THREATS_DODGED: u32 = 10_000;
const MAX_LEADERBOARD_LIMIT: u32 = 50;

#[derive(Default)]
pub struct ArcadeState {
    next_run_id: u64,
    scores: BTreeMap<ActorId, PlayerScore>,
}

#[derive(Encode, Decode, TypeInfo, ReflectHash, Clone, Debug, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[type_info(crate = sails_rs::type_info)]
#[reflect_hash(crate = sails_rs)]
pub struct PlayerScore {
    pub player: ActorId,
    pub best_score: u32,
    pub tasks_completed: u32,
    pub threats_dodged: u32,
    pub run_id: u64,
    pub updated_at: u64,
}

#[derive(Encode, Decode, TypeInfo, ReflectHash, Clone, Debug, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[type_info(crate = sails_rs::type_info)]
#[reflect_hash(crate = sails_rs)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub player: ActorId,
    pub best_score: u32,
    pub tasks_completed: u32,
    pub threats_dodged: u32,
    pub run_id: u64,
    pub updated_at: u64,
}

#[derive(Encode, Decode, TypeInfo, ReflectHash, Clone, Debug, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[type_info(crate = sails_rs::type_info)]
#[reflect_hash(crate = sails_rs)]
pub struct SubmitScoreReply {
    pub run_id: u64,
    pub accepted: bool,
    pub improved: bool,
    pub previous_best: u32,
    pub current_best: u32,
    pub rank: Option<u32>,
}

#[derive(Encode, Decode, TypeInfo, ReflectHash, Clone, Copy, Debug, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[type_info(crate = sails_rs::type_info)]
#[reflect_hash(crate = sails_rs)]
pub enum ArcadeError {
    InvalidScore,
    InvalidStats,
    LimitTooLarge,
}

#[sails_rs::event]
#[derive(Encode, Decode, TypeInfo, ReflectHash, Clone, Debug, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[type_info(crate = sails_rs::type_info)]
#[reflect_hash(crate = sails_rs)]
pub enum ArcadeEvent {
    BestScoreUpdated {
        player: ActorId,
        run_id: u64,
        previous_best: u32,
        new_best: u32,
        tasks_completed: u32,
        threats_dodged: u32,
        updated_at: u64,
    },
}

pub struct AgentArcade<'a> {
    state: &'a RefCell<ArcadeState>,
}

impl<'a> AgentArcade<'a> {
    pub fn new(state: &'a RefCell<ArcadeState>) -> Self {
        Self { state }
    }
}

#[sails_rs::service(events = ArcadeEvent)]
impl<'a> AgentArcade<'a> {
    #[export(unwrap_result)]
    pub fn submit_score(
        &mut self,
        score: u32,
        tasks_completed: u32,
        threats_dodged: u32,
    ) -> Result<SubmitScoreReply, ArcadeError> {
        validate_score(score)?;
        validate_stats(tasks_completed, threats_dodged)?;

        let player = msg::source();
        let updated_at = exec::block_timestamp();

        let mut state = self.state.borrow_mut();
        state.next_run_id = state.next_run_id.checked_add(1).expect("run id overflow");
        let run_id = state.next_run_id;

        let previous_best = state
            .scores
            .get(&player)
            .map(|entry| entry.best_score)
            .unwrap_or_default();
        let improved = score > previous_best;

        if improved {
            state.scores.insert(
                player,
                PlayerScore {
                    player,
                    best_score: score,
                    tasks_completed,
                    threats_dodged,
                    run_id,
                    updated_at,
                },
            );
        }

        let current_best = state
            .scores
            .get(&player)
            .map(|entry| entry.best_score)
            .unwrap_or(previous_best);
        let rank = rank_for_player(&state.scores, player);

        drop(state);

        if improved {
            self.emit_event(ArcadeEvent::BestScoreUpdated {
                player,
                run_id,
                previous_best,
                new_best: score,
                tasks_completed,
                threats_dodged,
                updated_at,
            })
            .expect("emit BestScoreUpdated failed");
        }

        Ok(SubmitScoreReply {
            run_id,
            accepted: true,
            improved,
            previous_best,
            current_best,
            rank,
        })
    }

    #[export(unwrap_result)]
    pub fn leaderboard(&self, limit: u32) -> Result<Vec<LeaderboardEntry>, ArcadeError> {
        if limit > MAX_LEADERBOARD_LIMIT {
            return Err(ArcadeError::LimitTooLarge);
        }

        let state = self.state.borrow();
        Ok(sorted_entries(&state.scores)
            .into_iter()
            .take(limit as usize)
            .enumerate()
            .map(|(index, score)| LeaderboardEntry {
                rank: index as u32 + 1,
                player: score.player,
                best_score: score.best_score,
                tasks_completed: score.tasks_completed,
                threats_dodged: score.threats_dodged,
                run_id: score.run_id,
                updated_at: score.updated_at,
            })
            .collect())
    }

    #[export]
    pub fn player_best_score(&self, player: ActorId) -> Option<PlayerScore> {
        self.state.borrow().scores.get(&player).cloned()
    }

    #[export]
    pub fn player_rank(&self, player: ActorId) -> Option<u32> {
        rank_for_player(&self.state.borrow().scores, player)
    }

    #[export]
    pub fn scores_count(&self) -> u32 {
        self.state.borrow().scores.len() as u32
    }

    #[export]
    pub fn game_info(&self) -> String {
        "Agent Arcade: guide a semi-autonomous agent through the Vara network, collect tasks, dodge spam, and commit your best run on-chain.".into()
    }
}

#[derive(Default)]
pub struct Program {
    state: RefCell<ArcadeState>,
}

#[sails_rs::program]
impl Program {
    pub fn create() -> Self {
        Self {
            state: RefCell::new(ArcadeState::default()),
        }
    }

    pub fn agent_arcade(&self) -> AgentArcade<'_> {
        AgentArcade::new(&self.state)
    }
}

fn validate_score(score: u32) -> Result<(), ArcadeError> {
    if score == 0 || score > MAX_SCORE {
        return Err(ArcadeError::InvalidScore);
    }

    Ok(())
}

fn validate_stats(tasks_completed: u32, threats_dodged: u32) -> Result<(), ArcadeError> {
    if tasks_completed > MAX_TASKS_COMPLETED || threats_dodged > MAX_THREATS_DODGED {
        return Err(ArcadeError::InvalidStats);
    }

    Ok(())
}

fn sorted_entries(scores: &BTreeMap<ActorId, PlayerScore>) -> Vec<PlayerScore> {
    let mut entries: Vec<PlayerScore> = scores.values().cloned().collect();
    entries.sort_by(|left, right| {
        right
            .best_score
            .cmp(&left.best_score)
            .then_with(|| left.player.cmp(&right.player))
    });
    entries
}

fn rank_for_player(scores: &BTreeMap<ActorId, PlayerScore>, player: ActorId) -> Option<u32> {
    sorted_entries(scores)
        .iter()
        .position(|entry| entry.player == player)
        .map(|index| index as u32 + 1)
}
