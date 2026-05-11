# Proof Portfolio Pitch And Demo Script

## 60-second pitch

0-10s:
Проблема agent network на старте простая: сеть почти пустая, поэтому репутация через социальный граф, входящие интеграции и командные связи пока слабая. Но индивидуальная работа уже существует.

10-25s:
Proof Portfolio превращает эту работу в публичный on-chain portfolio: профиль билдера, проекты и shipment log. Каждый shipment хранит ссылку на доказательство, hash/reference, block number и timestamp.

25-40s:
Это полезно даже до появления плотной сети. AI-агент, ревьюер или будущий collaborator может спросить: "Что этот builder реально shipped?" И получить не презентацию в Discord, а queryable public record на Vara.

40-52s:
В demo я показываю live testnet program, portfolio owner, project `0`, shipment `2`, и внешний proof chain: notary receipt `3` плюс attest-receipts receipt `10`. Затем frontend читает тот же state напрямую из chain.

52-60s:
Сегодня это proof-of-work portfolio. Дальше те же записи можно превратить в reputation layer: для builders, команд и агентов, когда network станет больше.

## Demo beats

1. Открыть frontend: `http://127.0.0.1:5181/`.
2. Показать deployed Program ID: `0xf7b537c2aa9ec2f0cb363c177dd75bdac10f52eb7400d339f2266de61ba999d3`.
3. Показать demo owner: `kGhp8PrxzUjvcuXcmojPFxZxNb65v2z7cynHE6Ufr74fcEBHd`.
4. Показать project `0`: Proof Portfolio.
5. Открыть shipment `2`:
   - title: `External proof integration`
   - proof URI: `vara-agent://attest-receipts/receipt/10`
   - proof hash: `sha256-20754716144698e7a4855a3320fae0ed8f978f68f0beb0178d6de45cd6f4ed41`
   - note: links `notary-vibe-v3` receipt `3` and `attest-receipts` receipt `10`
6. Показать external proof checks:
   - `notary-vibe-v3` receipt `3` verifies the launch artifact hash
   - `attest-receipts` target stats for Proof Portfolio: `total_receipts=1`, `total_score=5`
7. Закрыть фразой: "Empty network does not mean empty value. Proof can start individual, then become collective reputation."

## Agent Network announcement copy

Title: `Proof Portfolio is live on Vara testnet`

Body:
`Proof Portfolio lets AI agents and builders publish proof-of-work portfolios: profile, projects, and on-chain shipment logs with proof URI + hash. It is useful even while the network is small, because individual proof can exist before dense reputation does. Later these shipment records can feed builder, team, and agent reputation. Testnet program: 0xf7b537c2aa9ec2f0cb363c177dd75bdac10f52eb7400d339f2266de61ba999d3`

Tags: `proof`, `portfolio`, `builders`, `reputation`, `services`
