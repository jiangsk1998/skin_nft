# mint_nft 指令文档

## 概述

铸造一个基于 SPL Token + Metaplex Token Metadata 标准的 NFT，并将其发送到调用者的关联代币账户（ATA）。

---

## 依赖

```toml
# programs/skins_nft/Cargo.toml
anchor-lang    = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl     = { version = "0.32.1", features = ["token", "associated_token", "metadata"] }
mpl-token-metadata = { version = "5.1.1" }
solana-instruction = "=2.2.1"  # 锁定版本，解决 anchor-spl 与 anchor-lang 的传递依赖冲突
```

---

## 指令参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | `String` | NFT 名称 |
| `symbol` | `String` | NFT 符号（如 `SKIN`） |
| `uri` | `String` | 元数据 JSON 的 URI（链下存储地址） |

---

## 账户结构

```rust
pub struct MintNft<'info> {
    pub user: Signer<'info>,              // 付款方 & 权限方
    pub mint: Account<'info, Mint>,       // 新建的 Mint 账户
    pub token_account: Account<'info, TokenAccount>, // 用户的 ATA
    pub metadata_account: UncheckedAccount<'info>,   // Metaplex Metadata PDA
    pub master_edition_account: UncheckedAccount<'info>, // Metaplex Master Edition PDA
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
}
```

### 账户说明

| 账户 | 约束 | 说明 |
|---|---|---|
| `user` | `mut`, `Signer` | 交易发起者，支付所有账户的租金 |
| `mint` | `init`, `decimals=0`, `authority=user` | 新建 Mint，小数位为 0（NFT 标准），由 Anchor 初始化 |
| `token_account` | `init_if_needed`, ATA | 用户持有该 NFT 的关联代币账户 |
| `metadata_account` | PDA，由 Metaplex 初始化 | 存储 NFT 名称、符号、URI 等元数据 |
| `master_edition_account` | PDA，由 Metaplex 初始化 | 标记为 Master Edition，限制增发 |
| `system_program` | 自动解析 | Solana 系统程序 |
| `rent` | 自动解析 | 租金 Sysvar |
| `token_program` | 自动解析 | SPL Token 程序 |
| `associated_token_program` | 自动解析 | ATA 程序 |
| `metadata_program` | 自动解析 | Metaplex Token Metadata 程序 |

### PDA 推导规则

```
metadata_account seeds:
  ["metadata", metadata_program_id, mint_pubkey]

master_edition_account seeds:
  ["metadata", metadata_program_id, mint_pubkey, "edition"]
```

---

## 执行流程

```
1. Anchor 初始化 Mint 账户（decimals=0）
   ↓
2. mint_to(amount=1) → 铸造 1 个 token 到用户 ATA
   ↓
3. create_metadata_accounts_v3 → 创建 Metaplex Metadata 账户
   ↓
4. create_master_edition_v3(max_supply=Some(0)) → 创建 Master Edition，禁止增发
```

> `max_supply = Some(0)` 表示不允许印制任何版次（Print Edition），该 NFT 为唯一 1/1。

---

## 元数据字段

| 字段 | 值 | 说明 |
|---|---|---|
| `name` | 调用方传入 | NFT 名称 |
| `symbol` | 调用方传入 | NFT 符号 |
| `uri` | 调用方传入 | 链下元数据 JSON 地址 |
| `seller_fee_basis_points` | `500` | 二级市场版税 5%（100 = 1%） |
| `creators` | `None` | 可扩展，添加创作者及版税分配 |
| `collection` | `None` | 可扩展，关联到某个 Collection |
| `is_mutable` | `false` | 元数据创建后**不可修改** |

---

## 签名要求

| 账户 | 是否需要签名 | 原因 |
|---|---|---|
| `user` | **自动**（provider 钱包） | Anchor provider 自动签名 |
| `mint` | **手动**（`.signers([mintKeypair])`） | `init` 账户要求本身签名 |

---

## 客户端调用示例（TypeScript）

```typescript
import * as anchor from "@coral-xyz/anchor";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.SkinsNft;

const mintKeypair = anchor.web3.Keypair.generate();

const tx = await program.methods
  .mintNft(
    "Skin #1",                        // name
    "SKIN",                           // symbol
    "https://arweave.net/your-uri"    // uri
  )
  .accounts({
    user: provider.wallet.publicKey,
    mint: mintKeypair.publicKey,
    // 其余账户 Anchor 自动解析，无需填写
  })
  .signers([mintKeypair])             // mint 为 init 账户，必须签名
  .rpc();

console.log("Mint:", mintKeypair.publicKey.toBase58());
console.log("Tx:", tx);
```

### 自动解析的账户

以下账户 Anchor 客户端会根据 IDL 约束自动推导，**不需要手动传入**：

- `tokenAccount` — 由 `mint` + `user` 推导的 ATA 地址
- `metadataAccount` — 由 seeds 推导的 PDA
- `masterEditionAccount` — 由 seeds 推导的 PDA
- `tokenProgram` — 实现了 `Id` trait，已知程序 ID
- `associatedTokenProgram` — 同上
- `systemProgram` — 同上
- `rent` — Sysvar，自动解析
- `metadataProgram` — `anchor_spl::metadata::Metadata` 实现了 `Id` trait，自动解析

---

## 注意事项

1. **`is_mutable = false`**：元数据创建后永久不可更改，包括 URI。若需要支持皮肤升级，应改为 `true`。
2. **版税字段 `creators`**：目前为 `None`，二级市场版税（`seller_fee_basis_points=500`）虽设置但无法分配，需填写 `creators` 列表才能实际生效。
