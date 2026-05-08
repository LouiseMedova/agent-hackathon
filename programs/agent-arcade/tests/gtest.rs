use ::agent_arcade_client::{
    AgentArcadeClient as _, AgentArcadeClientCtors as _, agent_arcade::AgentArcade as _,
};
use sails_rs::{client::*, gtest::*, prelude::*};

const DEPLOYER: u64 = 42;
const ALICE: u64 = 101;
const BOB: u64 = 102;
const CAROL: u64 = 103;
const FUND: ValueUnit = 1_000_000_000_000_000;

#[tokio::test]
async fn submit_score_keeps_only_player_best() {
    let (env, program_code_id) = create_env();
    let program = deploy(&env, program_code_id).await;
    let mut service = program.agent_arcade();

    let first = service
        .submit_score(120, 8, 2)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap();
    assert!(first.accepted);
    assert!(first.improved);
    assert_eq!(first.previous_best, 0);
    assert_eq!(first.current_best, 120);

    let lower = service
        .submit_score(90, 12, 4)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap();
    assert!(lower.accepted);
    assert!(!lower.improved);
    assert_eq!(lower.previous_best, 120);
    assert_eq!(lower.current_best, 120);

    let best = service
        .player_best_score(ALICE.into())
        .await
        .unwrap()
        .expect("alice should have a score");
    assert_eq!(best.best_score, 120);
    assert_eq!(best.tasks_completed, 8);
    assert_eq!(best.threats_dodged, 2);
    assert_eq!(service.scores_count().await.unwrap(), 1);
}

#[tokio::test]
async fn leaderboard_orders_by_score_desc_then_actor_id() {
    let (env, program_code_id) = create_env();
    let program = deploy(&env, program_code_id).await;
    let mut service = program.agent_arcade();

    service
        .submit_score(100, 5, 1)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap();
    service
        .submit_score(250, 11, 3)
        .with_actor_id(CAROL.into())
        .await
        .unwrap()
        .unwrap();
    service
        .submit_score(250, 10, 2)
        .with_actor_id(BOB.into())
        .await
        .unwrap()
        .unwrap();

    let leaders = service.leaderboard(10).await.unwrap().unwrap();
    assert_eq!(leaders.len(), 3);
    assert_eq!(leaders[0].rank, 1);
    assert_eq!(leaders[0].player, ActorId::from(BOB));
    assert_eq!(leaders[0].best_score, 250);
    assert_eq!(leaders[1].rank, 2);
    assert_eq!(leaders[1].player, ActorId::from(CAROL));
    assert_eq!(leaders[1].best_score, 250);
    assert_eq!(leaders[2].rank, 3);
    assert_eq!(leaders[2].player, ActorId::from(ALICE));
    assert_eq!(leaders[2].best_score, 100);

    assert_eq!(service.player_rank(BOB.into()).await.unwrap(), Some(1));
    assert_eq!(service.player_rank(CAROL.into()).await.unwrap(), Some(2));
    assert_eq!(service.player_rank(ALICE.into()).await.unwrap(), Some(3));
}

#[tokio::test]
async fn rejects_invalid_scores_and_limits() {
    let (env, program_code_id) = create_env();
    let program = deploy(&env, program_code_id).await;
    let mut service = program.agent_arcade();

    service
        .submit_score(0, 0, 0)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap_err();
    service
        .submit_score(1_000_001, 0, 0)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap_err();
    service
        .submit_score(100, 10_001, 0)
        .with_actor_id(ALICE.into())
        .await
        .unwrap()
        .unwrap_err();
    service.leaderboard(51).await.unwrap().unwrap_err();

    assert_eq!(service.scores_count().await.unwrap(), 0);
}

fn create_env() -> (GtestEnv, CodeId) {
    let system = System::new();
    system.init_logger_with_default_filter("gwasm=error,gtest=error,sails_rs=error");
    system.mint_to(DEPLOYER, FUND);
    system.mint_to(ALICE, FUND);
    system.mint_to(BOB, FUND);
    system.mint_to(CAROL, FUND);

    let code_id = system.submit_code(::agent_arcade::WASM_BINARY);
    let env = GtestEnv::new(system, DEPLOYER.into());
    (env, code_id)
}

async fn deploy(
    env: &GtestEnv,
    code_id: CodeId,
) -> sails_rs::client::Actor<agent_arcade_client::AgentArcadeClientProgram, GtestEnv> {
    env.clone()
        .deploy::<agent_arcade_client::AgentArcadeClientProgram>(code_id, b"salt".to_vec())
        .create()
        .await
        .unwrap()
}
