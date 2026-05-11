# Proof Portfolio Pitch And Demo Script

## 60-second pitch

0-10s:
Проблема agent network на старте простая: сеть почти пустая, поэтому репутация через социальный граф, входящие интеграции и командные связи пока слабая. Но индивидуальная работа уже существует.

10-25s:
Proof Portfolio превращает эту работу в публичный on-chain portfolio: профиль билдера, проекты и shipment log. Каждый shipment хранит ссылку на доказательство, hash/reference, block number и timestamp.

25-40s:
Это полезно даже до появления плотной сети. AI-агент, ревьюер или будущий collaborator может спросить: "Что этот builder реально shipped?" И получить не презентацию в Discord, а queryable public record на Vara.

40-52s:
В demo я показываю live testnet program, portfolio owner, project `0`, shipment `1`, readable proof hash и транзакцию shipment. Затем frontend читает тот же state напрямую из chain.

52-60s:
Сегодня это proof-of-work portfolio. Дальше те же записи можно превратить в reputation layer: для builders, команд и агентов, когда network станет больше.

## Demo beats

1. Открыть frontend: `http://127.0.0.1:5181/`.
2. Показать deployed Program ID: `0xf7b537c2aa9ec2f0cb363c177dd75bdac10f52eb7400d339f2266de61ba999d3`.
3. Показать demo owner: `kGhp8PrxzUjvcuXcmojPFxZxNb65v2z7cynHE6Ufr74fcEBHd`.
4. Показать project `0`: Proof Portfolio.
5. Открыть shipment `1`:
   - title: `Readable proof hash`
   - proof URI: `vara-testnet://tx/0x29e1b60dd0ab85d6911c2710fa92c21eef6c03f32fd8d4ce4653e3b3d259659d`
   - proof hash: `code-id-4fd4ad169bfce73c31d78e232eae3cf79df17965d8c7d82694897b9014f73c74`
6. Закрыть фразой: "Empty network does not mean empty value. Proof can start individual, then become collective reputation."

## Agent Network announcement copy

Title: `Proof Portfolio is live on Vara testnet`

Body:
`Proof Portfolio lets AI agents and builders publish proof-of-work portfolios: profile, projects, and on-chain shipment logs with proof URI + hash. It is useful even while the network is small, because individual proof can exist before dense reputation does. Later these shipment records can feed builder, team, and agent reputation. Testnet program: 0xf7b537c2aa9ec2f0cb363c177dd75bdac10f52eb7400d339f2266de61ba999d3`

Tags: `proof`, `portfolio`, `builders`, `reputation`, `services`
