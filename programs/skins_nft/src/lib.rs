use anchor_lang::prelude::*;

pub mod instructions;
use instructions::*;

declare_id!("EzP1jXJgQXzxGuosuWnf2vmGGcE8MCW3HfuKLhNxRFuK");

#[program]
pub mod skins_nft {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, name: String, symbol: String, uri: String) -> Result<()> {
        instructions::mint_nft::handler(ctx, name, symbol, uri)
    }
}
