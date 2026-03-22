import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/rover_mission.py");
  try {
    const contractCode = new Uint8Array(readFileSync(filePath));
    await client.initializeConsensusSmartContract();

    console.log("Deploying RoverMission contract to Bradbury...");

    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: [],
    });

    console.log(`Deploy TX: ${deployTransaction}`);

    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
    });

    if (
      receipt.status !== 5 &&
      receipt.status !== 6 &&
      receipt.statusName !== "ACCEPTED" &&
      receipt.statusName !== "FINALIZED"
    ) {
      throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
    }

    const deployedContractAddress =
      (client.chain as GenLayerChain).id === localnet.id
        ? receipt.data.contract_address
        : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

    console.log(`RoverMission deployed at: ${deployedContractAddress}`);

    // Guardar address para usar en el bridge
    const fs = await import("fs");
    fs.writeFileSync(
      path.resolve(process.cwd(), "contract_address.txt"),
      deployedContractAddress
    );
    console.log("Address saved to contract_address.txt");

  } catch (error) {
    throw new Error(`Deployment error: ${error}`);
  }
}