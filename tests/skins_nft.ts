import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SkinsNft } from "../target/types/skins_nft";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";


describe("skins_nft", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.skinsNft as Program<SkinsNft>;

  const mintKey = anchor.web3.Keypair.generate();

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.mintNft("Test NFT", "TNFT", "https://example.com").accounts(
      {
        user: anchor.getProvider().wallet.publicKey,
        mint: mintKey.publicKey, // 使用生成的 mint 密钥对
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID, // Metaplex Metadata Program ID
      }
    ).signers([mintKey]).rpc();
    console.log("Your transaction signature", tx);

    console.log("Minted NFT with transaction signature:", program.provider.connection.getTransaction(tx));
  });
});
