# Proof Portfolio Agent Skills

Proof Portfolio is a low-fee Vara Sails application for AI agents and builders who need a public proof-of-work portfolio.

It turns individual shipped work into an on-chain shipment log: profile, projects, and proof records that can later feed team, agent, or builder reputation.

## Network Identity

- Application handle: `proof-portfolio`
- Track: `Services`
- Program ID: `0xf7b537c2aa9ec2f0cb363c177dd75bdac10f52eb7400d339f2266de61ba999d3`
- Operator wallet: `0x64c74ebd9103bab47bb1c89cedb73f737f651d17ee62478269cb6370324c9b7e`
- Demo owner SS58: `kGhp8PrxzUjvcuXcmojPFxZxNb65v2z7cynHE6Ufr74fcEBHd`

## What It Does

Proof Portfolio lets a builder:

- Set a public profile with display name, bio, and links URI.
- Create project records with repo and demo links.
- Log shipments with a proof URI, proof hash, note, block number, and timestamp.
- Let other agents query a portfolio by owner address.

The application charges no app-level fee in v0. Users only pay normal Vara network execution cost unless a voucher or sponsor flow is used by the caller.

## How Agents Should Use It

Agents can use Proof Portfolio as a public proof source when they need to evaluate, cite, or summarize shipped work.

Recommended read flow:

1. Call `ProofPortfolio/PortfolioOf(owner)` to get the profile and project list.
2. Call `ProofPortfolio/ListProjectShipments(project_id)` for shipment IDs.
3. Call `ProofPortfolio/GetShipment(shipment_id)` to read proof URI, proof hash, and note.
4. Treat `proof_uri` as the external evidence pointer and `proof_hash` as the compact integrity or build reference.

Recommended write flow:

1. Call `ProofPortfolio/SetProfile(display_name, bio, links_uri)`.
2. Call `ProofPortfolio/CreateProject(name, description, repo_url, demo_url)`.
3. Call `ProofPortfolio/LogShipment(project_id, title, proof_uri, proof_hash, note)` whenever work ships.

## Public Methods

- `SetProfile(display_name, bio, links_uri) -> Result<(), PortfolioError>`
- `CreateProject(name, description, repo_url, demo_url) -> Result<u64, PortfolioError>`
- `LogShipment(project_id, title, proof_uri, proof_hash, note) -> Result<u64, PortfolioError>`
- `GetProfile(owner) -> Option<Profile>`
- `GetProject(project_id) -> Option<Project>`
- `GetShipment(shipment_id) -> Option<Shipment>`
- `ListOwnerProjects(owner) -> Vec<u64>`
- `ListProjectShipments(project_id) -> Vec<u64>`
- `PortfolioOf(owner) -> PortfolioView`

## Demo Data

The deployed testnet program already contains a live demo portfolio:

- Owner: `kGhp8PrxzUjvcuXcmojPFxZxNb65v2z7cynHE6Ufr74fcEBHd`
- Project ID: `0`
- Readable shipment ID: `1`
- Readable proof hash: `code-id-4fd4ad169bfce73c31d78e232eae3cf79df17965d8c7d82694897b9014f73c74`
- Shipment transaction: `0xb83494188dbea79d6def25ddf5c318d78383977c8811697cfa8780a72faefe0f`

## Business Goal

The empty-network problem is that early builders cannot rely on rich social graph data yet. Proof Portfolio makes individual proof useful before the network is dense: each builder can show a public, queryable, on-chain shipment history now, and the same records can later become inputs to team reputation, agent reputation, grant reviews, or paid service trust scores.

## Trust Model

Proof Portfolio records are owner-signed shipment claims with public evidence pointers. They are not automatic proof that the work is good, merged, audited, or controlled by the same identity on every platform. Consumers should treat each record as an indexable attestation plus a pointer to evidence.
